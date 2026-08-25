import net from "net";

// A mail server that speaks just enough SMTP to test a transport against
// something real rather than a mock.
//
// A state machine rather than nested once("data") listeners. AUTH LOGIN is a
// multi-line exchange, and one-shot listeners race the main handler, which
// then answers the username line with a generic 250 and corrupts the sequence.
// That bug cost an afternoon once; it is not worth rediscovering.

const CRLF = "\r\n";

export interface FakeSmtpServer {
  port: number;
  // The raw DATA section of every message the server accepted.
  received: string[];
  stop: () => Promise<void>;
}

export interface FakeSmtpOptions {
  // Refuse every login, for testing the failure path.
  rejectAuth?: boolean;
}

export function startSmtpServer(options: FakeSmtpOptions = {}): Promise<FakeSmtpServer> {
  const received: string[] = [];

  const server = net.createServer((socket) => {
    let state: "commands" | "auth-user" | "auth-pass" | "data" = "commands";
    let buffer = "";

    socket.write(`220 test.invalid ESMTP${CRLF}`);

    socket.on("data", (chunk) => {
      buffer += chunk.toString();

      while (buffer.length > 0) {
        if (state === "data") {
          const terminator = `${CRLF}.${CRLF}`;
          const end = buffer.indexOf(terminator);
          if (end === -1) return;

          received.push(buffer.slice(0, end));
          buffer = buffer.slice(end + terminator.length);
          state = "commands";
          socket.write(`250 2.0.0 Ok: queued${CRLF}`);
          continue;
        }

        const brk = buffer.indexOf(CRLF);
        if (brk === -1) return;
        const line = buffer.slice(0, brk);
        buffer = buffer.slice(brk + CRLF.length);

        if (state === "auth-user") {
          state = "auth-pass";
          socket.write(`334 UGFzc3dvcmQ6${CRLF}`);
          continue;
        }
        if (state === "auth-pass") {
          state = "commands";
          socket.write(`235 2.7.0 Accepted${CRLF}`);
          continue;
        }

        const command = line.slice(0, 4).toUpperCase();

        if (command === "EHLO" || command === "HELO") {
          socket.write(`250-test.invalid${CRLF}250-AUTH LOGIN PLAIN${CRLF}250 OK${CRLF}`);
        } else if (command === "AUTH") {
          if (options.rejectAuth) {
            socket.write(`535 5.7.8 Authentication credentials invalid${CRLF}`);
            continue;
          }
          state = "auth-user";
          socket.write(`334 VXNlcm5hbWU6${CRLF}`);
        } else if (command === "DATA") {
          state = "data";
          socket.write(`354 Go ahead${CRLF}`);
        } else if (command === "QUIT") {
          socket.write(`221 Bye${CRLF}`);
          socket.end();
        } else {
          socket.write(`250 OK${CRLF}`);
        }
      }
    });

    socket.on("error", () => { /* the client hung up, which several tests do */ });
  });

  return new Promise((resolve) => {
    // Port 0 lets the OS pick, so suites can run in parallel without colliding.
    server.listen(0, "127.0.0.1", () => {
      resolve({
        port: (server.address() as net.AddressInfo).port,
        received,
        stop: () => new Promise<void>((done) => server.close(() => done())),
      });
    });
  });
}
