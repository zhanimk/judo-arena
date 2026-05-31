import { useTranslation } from "react-i18next";
import { Check, X } from "lucide-react";

export interface PasswordRules {
  length: boolean;
  upper: boolean;
  lower: boolean;
  digit: boolean;
}

export function checkPasswordRules(password: string): PasswordRules {
  return {
    length: password.length >= 8,
    upper:  /[A-Z]/.test(password),
    lower:  /[a-z]/.test(password),
    digit:  /[0-9]/.test(password),
  };
}

export function isPasswordStrong(password: string): boolean {
  const r = checkPasswordRules(password);
  return r.length && r.upper && r.lower && r.digit;
}

/** Returns 0-4 score (count of passed rules). */
function score(rules: PasswordRules): number {
  return [rules.length, rules.upper, rules.lower, rules.digit].filter(Boolean).length;
}

const STRENGTH_COLORS = ["", "bg-red-500", "bg-orange-400", "bg-yellow-400", "bg-green-500"];
const STRENGTH_KEYS   = ["", "pwd_strength_weak", "pwd_strength_fair", "pwd_strength_good", "pwd_strength_strong"];

interface Props {
  password: string;
  /** Only render when password field has been touched */
  visible?: boolean;
}

export function PasswordStrength({ password, visible = true }: Props) {
  const { t } = useTranslation();

  if (!visible || password.length === 0) return null;

  const rules = checkPasswordRules(password);
  const s     = score(rules);

  const rulesConfig: { key: keyof PasswordRules; label: string }[] = [
    { key: "length", label: t("auth.pwd_rule_length") },
    { key: "upper",  label: t("auth.pwd_rule_upper")  },
    { key: "lower",  label: t("auth.pwd_rule_lower")  },
    { key: "digit",  label: t("auth.pwd_rule_digit")  },
  ];

  return (
    <div className="mt-2 space-y-2">
      {/* Strength bar */}
      <div className="flex items-center gap-2">
        <div className="flex flex-1 gap-1">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                i <= s ? STRENGTH_COLORS[s] : "bg-border"
              }`}
            />
          ))}
        </div>
        {s > 0 && (
          <span className={`text-[11px] font-medium transition-colors ${
            s === 4 ? "text-green-500" : s === 3 ? "text-yellow-500" : s === 2 ? "text-orange-400" : "text-red-500"
          }`}>
            {t(`auth.${STRENGTH_KEYS[s]}`)}
          </span>
        )}
      </div>

      {/* Rules checklist */}
      <ul className="space-y-1">
        {rulesConfig.map(({ key, label }) => (
          <li key={key} className="flex items-center gap-1.5">
            {rules[key] ? (
              <Check className="h-3 w-3 text-green-500 shrink-0" />
            ) : (
              <X className="h-3 w-3 text-muted-foreground/50 shrink-0" />
            )}
            <span className={`text-[11px] transition-colors ${
              rules[key] ? "text-green-500" : "text-muted-foreground/60"
            }`}>
              {label}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
