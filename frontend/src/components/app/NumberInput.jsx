import { forwardRef } from "react";
import { Input } from "@/components/ui/input";

// Format a number to IDN-style thousand separators using "."
function formatIDN(n) {
  if (n === "" || n === null || n === undefined) return "";
  const digits = String(n).replace(/[^\d]/g, "");
  if (!digits) return "";
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

function parseIDN(s) {
  const digits = String(s ?? "").replace(/[^\d]/g, "");
  return digits === "" ? 0 : Number(digits);
}

/**
 * NumberInput — text input that displays "Rp"-style dot-grouped numbers and returns a plain Number to the parent.
 * Props:
 *   value (number)
 *   onChange (number) => void
 *   placeholder, className, disabled, prefix (e.g., "Rp"), etc.
 */
const NumberInput = forwardRef(function NumberInput(
  { value, onChange, prefix, className = "", ...rest },
  ref
) {
  const display = value === 0 || value === "" || value === null || value === undefined ? "" : formatIDN(value);
  return (
    <div className="relative">
      {prefix && (
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
          {prefix}
        </span>
      )}
      <Input
        ref={ref}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        value={display}
        onChange={(e) => onChange?.(parseIDN(e.target.value))}
        className={`${prefix ? "pl-9" : ""} ${className}`}
        {...rest}
      />
    </div>
  );
});

export default NumberInput;
export { formatIDN, parseIDN };
