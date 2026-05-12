import { Mail, Send, Clock, CheckCircle } from "lucide-react";

const OUTREACH_STATS = [
  { label: "Sent", icon: Send, color: "text-blue-400", bg: "bg-blue-500/10", count: 0 },
  { label: "Pending", icon: Clock, color: "text-amber-400", bg: "bg-amber-500/10", count: 0 },
  { label: "Delivered", icon: CheckCircle, color: "text-green-400", bg: "bg-green-500/10", count: 0 },
];

export default function OutreachPage() {
  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-text-1">Outreach</h2>
        <p className="text-text-3 mt-1">Track all sent emails and their delivery status</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {OUTREACH_STATS.map(({ label, icon: Icon, color, bg, count }) => (
          <div key={label} className="bg-bg-2 border border-border rounded-xl p-5">
            <div className={`w-10 h-10 rounded-lg ${bg} flex items-center justify-center mb-3`}>
              <Icon className={`h-5 w-5 ${color}`} />
            </div>
            <p className="text-2xl font-bold text-text-1">{count}</p>
            <p className="text-sm text-text-3 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Empty state */}
      <div className="bg-bg-2 border border-border rounded-2xl p-12 flex flex-col items-center text-center gap-4">
        <div className="w-16 h-16 rounded-2xl bg-bg-3 flex items-center justify-center">
          <Mail className="h-8 w-8 text-text-3" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-text-1">No emails sent yet</h3>
          <p className="text-sm text-text-3 mt-1 max-w-md">
            Generate outreach for a lead and send it directly from the app.
            All sent emails will be tracked here with delivery status.
          </p>
        </div>
      </div>
    </div>
  );
}
