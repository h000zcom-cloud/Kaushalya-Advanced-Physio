import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

export function ConfirmDialog({ open, onOpenChange, title, description, confirmLabel = "Confirm", destructive = false, onConfirm, loading = false, children }) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent data-testid="confirm-dialog">
        <AlertDialogHeader>
          <AlertDialogTitle className="font-admin">{title}</AlertDialogTitle>
          {description && <AlertDialogDescription>{description}</AlertDialogDescription>}
        </AlertDialogHeader>
        {children}
        <AlertDialogFooter>
          <AlertDialogCancel data-testid="confirm-dialog-cancel">Cancel</AlertDialogCancel>
          <AlertDialogAction data-testid="confirm-dialog-confirm" disabled={loading} onClick={(e) => { e.preventDefault(); onConfirm(); }} className={cn(destructive && "bg-destructive hover:bg-destructive/90")}>
            {loading ? "Working..." : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
