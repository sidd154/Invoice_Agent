const now = new Date();
const kolkataStr = now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
const kolkataDate = new Date(kolkataStr);

const weekdays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const currentWeekday = weekdays[kolkataDate.getDay()];
const currentHour = kolkataDate.getHours().toString().padStart(2, '0');
const currentMinute = kolkataDate.getMinutes().toString().padStart(2, '0');
const currentTime = `${currentHour}:${currentMinute}`;

console.log('UTC Time:', now.toISOString());
console.log('Kolkata String:', kolkataStr);
console.log('Kolkata Date:', kolkataDate.toString());
console.log('Current Weekday:', currentWeekday);
console.log('Current Time (24h):', currentTime);
