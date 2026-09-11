"use client";

import React, { forwardRef } from "react";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className, id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, "-");

    return (
      <div className="relative w-full group">
        <input
          ref={ref}
          id={inputId}
          placeholder=" "
          className={[
            "peer w-full px-4 pt-5 pb-2 rounded-xl",
            "bg-white/[0.06] border border-white/[0.1]",
            "text-white text-sm outline-none",
            "transition-all duration-300",
            "focus:border-cyan-400/60 focus:bg-white/[0.08]",
            "focus:shadow-[0_0_20px_rgba(100,210,255,0.12)]",
            "placeholder-transparent",
            error ? "border-red-400/60" : "",
            className,
          ]
            .filter(Boolean)
            .join(" ")}
          {...props}
        />
        {label && (
          <label
            htmlFor={inputId}
            className={[
              "absolute left-4 top-1/2 -translate-y-1/2 text-sm text-white/40",
              "transition-all duration-200 pointer-events-none",
              "peer-focus:top-3 peer-focus:text-[0.65rem] peer-focus:text-cyan-300/70",
              "peer-[:not(:placeholder-shown)]:top-3 peer-[:not(:placeholder-shown)]:text-[0.65rem] peer-[:not(:placeholder-shown)]:text-white/50",
            ].join(" ")}
          >
            {label}
          </label>
        )}
        {error && (
          <p className="mt-1 pl-1 text-xs text-red-400">{error}</p>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";
export { Input };
