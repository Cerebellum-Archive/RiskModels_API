export function printResults(data: unknown, asJson: boolean): void {
  if (asJson) {
    console.log(JSON.stringify(data, null, 2));
    return;
  }
  if (data === null || data === undefined) {
    console.log("(no data)");
    return;
  }
  if (Array.isArray(data) && data.length > 0 && typeof data[0] === "object") {
    console.table(data);
    return;
  }
  if (typeof data === "object") {
    console.log(JSON.stringify(data, null, 2));
    return;
  }
  console.log(String(data));
}
