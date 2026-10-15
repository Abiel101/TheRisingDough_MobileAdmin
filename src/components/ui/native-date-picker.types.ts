export type NativeDatePickerFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
};

export function dateToKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function dateFromKey(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year || 2000, (month || 1) - 1, day || 1, 12);
}

export function formatDateKey(value: string) {
  return dateFromKey(value).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}
