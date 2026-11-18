// Checks a generated cold email against the rules the prompt sets.
//
// The prompt asks for an email with no filler, and most of the time it gets
// one. But a rule that only exists in a prompt is a request, and the failure
// here is specific and recognisable: an opening that spends the one line the
// recipient will actually read on introducing the sender. So the output is
// checked, and a draft that breaks a rule is sent back once with the reasons.
//
// Pure functions, no I/O, so the rules can be tested without calling a model.

export const MAX_BODY_WORDS = 130; // The prompt says 120. A few words of slack.
export const MAX_SUBJECT_WORDS = 6;

// Openers that are about the sender, or about nothing at all.
const FILLER_OPENERS: [reason: string, re: RegExp][] = [
  ["it introduces the sender instead of saying something about the recipient", /^(?:my name is|i am|i'm|we are|we're|i work|i run|i lead|i help|we help|our (?:company|team|agency))\b/i],
  ["it announces the email instead of making the point", /\b(?:i am|i'm|we are|we're) (?:reaching out|writing|contacting|emailing|getting in touch)\b|\bi (?:just )?(?:wanted to|thought i(?:'d| would))\b|\bi came across\b|\bi stumbled (?:up)?on\b/i],
  ["it is a pleasantry", /\bi hope (?:this|you|all)\b|\bhope you(?:'re| are)\b|\btrust (?:this|you)\b|\bhow are you\b/i],
  ["it apologises for the email", /\bsorry (?:to|for)\b|\bi know you(?:'re| are) busy\b|\bquick (?:note|one|question)\b/i],
];

const BUZZWORDS = /\b(?:synergy|synergies|leverage|unlock|game[- ]changer|revolutioni[sz]e|cutting[- ]edge|world[- ]class)\b/i;

function words(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

// The first sentence after the greeting: the line that decides whether the
// rest gets read, and the one that shows in the inbox preview.
export function openingSentence(body: string): string {
  const lines = body
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const isGreeting = (line: string) =>
    /^(?:hi|hello|hey|dear|good (?:morning|afternoon|evening))\b/i.test(line) &&
    words(line) <= 8 &&
    !/[.?]$/.test(line);

  const first = lines.find((l) => !isGreeting(l)) ?? "";
  const end = first.search(/[.?!](?:\s|$)/);
  return end === -1 ? first : first.slice(0, end + 1);
}

export function lintColdEmail(subject: string, body: string): string[] {
  const issues: string[] = [];

  const opening = openingSentence(body);
  for (const [reason, re] of FILLER_OPENERS) {
    if (re.test(opening)) {
      issues.push(`The opening sentence ("${opening}") is filler: ${reason}.`);
      break;
    }
  }

  const count = words(body);
  if (count > MAX_BODY_WORDS) {
    issues.push(`The body is ${count} words. Cut it to 120 or fewer.`);
  }

  if (words(subject) > MAX_SUBJECT_WORDS) {
    issues.push(`The subject line is ${words(subject)} words. Use 2 to 5.`);
  }
  if (/!/.test(subject) || /quick question/i.test(subject)) {
    issues.push("The subject line reads like a mass email. No exclamation marks, no \"quick question\".");
  }

  const buzz = BUZZWORDS.exec(`${subject} ${body}`);
  if (buzz) issues.push(`Remove the buzzword "${buzz[0]}".`);

  if (/\[[^\]]{2,40}\]|\{\{[^}]+\}\}/.test(body)) {
    issues.push("The body contains an unfilled placeholder in brackets.");
  }

  const asks = (body.match(/\?/g) ?? []).length;
  if (asks > 2) {
    issues.push(`The body asks ${asks} questions. Ask for one thing, once.`);
  }

  return issues;
}

// Em dashes are banned in all copy. The model is told so and mostly complies;
// this makes it certain. A spaced dash becomes a comma, an unspaced one a comma
// and a space.
export function stripEmDashes(text: string): string {
  return text.replace(/\s*[—–]\s*/g, ", ");
}
