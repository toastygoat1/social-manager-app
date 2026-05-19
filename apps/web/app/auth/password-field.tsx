"use client";

import { useId, useState } from "react";

type Props = {
  id?: string;
  name: string;
  label: string;
  placeholder?: string;
  required?: boolean;
  showMeter?: boolean;
  minLength?: number;
  autoComplete?: string;
};

type Strength = {
  score: 0 | 1 | 2 | 3 | 4;
  label: string;
  color: string;
};

function scorePassword(pw: string): Strength {
  if (!pw) return { score: 0, label: "—", color: "bg-zinc-200" };

  let points = 0;
  if (pw.length >= 8) points++;
  if (pw.length >= 12) points++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) points++;
  if (/\d/.test(pw)) points++;
  if (/[^A-Za-z0-9]/.test(pw)) points++;

  if (pw.length < 8) {
    return { score: 1, label: "Too short", color: "bg-red-500" };
  }

  if (points <= 2) return { score: 1, label: "Weak", color: "bg-red-500" };
  if (points === 3) return { score: 2, label: "Fair", color: "bg-amber-500" };
  if (points === 4) return { score: 3, label: "Good", color: "bg-lime-500" };
  return { score: 4, label: "Strong", color: "bg-emerald-600" };
}

export function PasswordField({
  id,
  name,
  label,
  placeholder = "At least 8 characters",
  required,
  showMeter = false,
  minLength = 8,
  autoComplete = "current-password",
}: Props) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const [value, setValue] = useState("");
  const strength = scorePassword(value);
  const meterWidth = `${(strength.score / 4) * 100}%`;

  return (
    <div>
      <label
        htmlFor={inputId}
        className="mb-1 block text-sm font-medium text-zinc-700"
      >
        {label}
      </label>
      <input
        id={inputId}
        name={name}
        type="password"
        required={required}
        minLength={minLength}
        placeholder={placeholder}
        autoComplete={autoComplete}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-zinc-500"
      />
      {showMeter ? (
        <div className="mt-2 space-y-1">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-200">
            <div
              className={`h-full transition-all ${strength.color}`}
              style={{ width: value ? meterWidth : "0%" }}
            />
          </div>
          <p className="text-xs text-zinc-500">
            Strength: <span className="font-medium">{strength.label}</span>
            {value && value.length < 8
              ? " — needs 8+ chars"
              : value && !/[A-Z]/.test(value)
                ? " — add uppercase"
                : value && !/[a-z]/.test(value)
                  ? " — add lowercase"
                  : value && !/\d/.test(value)
                    ? " — add a digit"
                    : ""}
          </p>
        </div>
      ) : null}
    </div>
  );
}
