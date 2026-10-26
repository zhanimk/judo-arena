import { useTranslation } from "react-i18next";
export interface RegistrationSettingsValue {
  audience: "CHILD" | "ADULT" | "MIXED";
  clubRegistrationEnabled: boolean;
  selfRegistrationEnabled: boolean;
}
export function RegistrationSettings({
  value,
  onChange,
}: {
  value: RegistrationSettingsValue;
  onChange: (value: RegistrationSettingsValue) => void;
}) {
  const { t } = useTranslation();
  return (
    <fieldset className="my-4 space-y-3 rounded-md border border-border p-4">
      <legend className="px-2 font-medium">{t("registration.settings")}</legend>
      <label className="block text-sm">
        {t("registration.audience")}
        <select
          className="mt-1 block w-full rounded-md border border-border bg-background p-2"
          value={value.audience}
          onChange={(e) => {
            const audience = e.target.value as RegistrationSettingsValue["audience"];
            onChange({
              ...value,
              audience,
              selfRegistrationEnabled: audience === "CHILD" ? false : value.selfRegistrationEnabled,
            });
          }}
        >
          {(["CHILD", "ADULT", "MIXED"] as const).map((v) => (
            <option key={v} value={v}>
              {t(`registration.${v}`)}
            </option>
          ))}
        </select>
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={value.clubRegistrationEnabled}
          onChange={(e) => onChange({ ...value, clubRegistrationEnabled: e.target.checked })}
        />
        {t("registration.coach")}
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          disabled={value.audience === "CHILD"}
          checked={value.selfRegistrationEnabled}
          onChange={(e) => onChange({ ...value, selfRegistrationEnabled: e.target.checked })}
        />
        {t("registration.self")}
      </label>
      <p className="text-xs text-muted-foreground">{t("registration.manual_hint")}</p>
    </fieldset>
  );
}
