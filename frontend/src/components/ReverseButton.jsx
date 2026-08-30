import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Undo2 } from "lucide-react";
import { toast } from "sonner";
import { api, errMsg } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

export const ReverseButton = ({ refType, refId, refNo, onDone }) => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  if (user?.role !== "admin") return null;

  const submit = async () => {
    if (!reason.trim()) return toast.error("A reason is mandatory for reversals");
    setBusy(true);
    try {
      await api.post("/reversals", { ref_type: refType, ref_id: refId, reason });
      toast.success(`${refNo} reversed`);
      setOpen(false);
      setReason("");
      onDone?.();
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        data-testid={`btn-reverse-${refType}-${refId}`}
        className="text-rose-700 hover:text-rose-900 hover:bg-rose-50 h-7 px-2"
        onClick={() => setOpen(true)}
      >
        <Undo2 className="h-3.5 w-3.5 mr-1" /> Reverse
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent data-testid="reversal-dialog">
          <DialogHeader>
            <DialogTitle className="text-rose-800">Reverse {refNo}</DialogTitle>
            <DialogDescription>
              No deletes, ever. This posts counter entries to all ledgers and keeps a full audit trail.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            data-testid="reversal-reason-input"
            placeholder="Reason for reversal (required)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button data-testid="reversal-confirm-btn" className="bg-rose-700 hover:bg-rose-800 text-white" disabled={busy} onClick={submit}>
              {busy ? "Reversing..." : "Confirm Reversal"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
