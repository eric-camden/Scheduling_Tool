// Refactored Scheduler Script (full version)
const daysOfWeek = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const staffData = JSON.parse(localStorage.getItem("staffData")) || [];

const MINUTES_IN_DAY = 1440;
const DEFAULT_STAFF_ROWS = 30;

document.addEventListener("DOMContentLoaded", () => {
  setupDarkMode();
  buildStaffTable();
  setupCSVHandlers();
  generateHeatmap();
  generateDailyGrids();
});

function setupDarkMode() {
  const toggle = document.getElementById("dark-mode-toggle");
  if (localStorage.getItem("darkMode") === "enabled") {
    document.body.classList.add("dark-mode");
  }
  toggle.addEventListener("click", () => {
    document.body.classList.toggle("dark-mode");
    localStorage.setItem("darkMode", document.body.classList.contains("dark-mode") ? "enabled" : "disabled");
  });
}

function buildStaffTable() {
  const tbody = document.querySelector("#staff-input-table tbody");
  const saveBtn = document.getElementById("save-staff");

  for (let i = 0; i < DEFAULT_STAFF_ROWS; i++) {
    const row = document.createElement("tr");
    const staffEntry = staffData[i] || { name: '', startTime: '', hoursWorked: '', hasLunch: false, outTime: '', days: [] };

    const nameInput = createInput("text", staffEntry.name, `Staff ${i + 1}`);
    row.appendChild(wrapTd(nameInput));

    const startTimeInput = createInput("time", staffEntry.startTime);
    row.appendChild(wrapTd(startTimeInput));

    const hoursWorkedInput = createInput("number", staffEntry.hoursWorked);
    hoursWorkedInput.min = 1; hoursWorkedInput.max = 24;
    row.appendChild(wrapTd(hoursWorkedInput));

    const lunchInput = createInput("checkbox", '', '', staffEntry.hasLunch);
    row.appendChild(wrapTd(lunchInput));

    const outTimeInput = createInput("text", staffEntry.outTime);
    outTimeInput.readOnly = true;
    row.appendChild(wrapTd(outTimeInput));

    [startTimeInput, hoursWorkedInput, lunchInput].forEach(input => {
      input.addEventListener("input", () => {
        if (startTimeInput.value && hoursWorkedInput.value) {
          const [h, m] = startTimeInput.value.split(":").map(Number);
          let duration = parseInt(hoursWorkedInput.value, 10) * 60 + (lunchInput.checked ? 60 : 0);
          let end = h * 60 + m + duration;
          const hourEnd = Math.floor(end / 60) % 24;
          const minEnd = end % 60;
          outTimeInput.value = `${String(hourEnd).padStart(2, '0')}:${String(minEnd).padStart(2, '0')}`;
        } else {
          outTimeInput.value = '';
        }
      });
    });

    daysOfWeek.forEach(day => {
      const checkbox = createInput("checkbox", '', '', staffEntry.days.includes(day));
      row.appendChild(wrapTd(checkbox));
    });

    tbody.appendChild(row);
  }

  saveBtn.addEventListener("click", () => {
    const rows = Array.from(tbody.querySelectorAll("tr"));
    staffData.length = 0;
    rows.forEach(row => {
      const cells = row.querySelectorAll("td");
      const name = cells[0].querySelector("input").value.trim();
      const startTime = cells[1].querySelector("input").value;
      const hoursWorked = parseInt(cells[2].querySelector("input").value, 10);
      const hasLunch = cells[3].querySelector("input").checked;
      const outTime = cells[4].querySelector("input").value;

      if (name && startTime && hoursWorked && outTime) {
        const entry = {
          name,
          startTime,
          hoursWorked,
          hasLunch,
          outTime,
          days: daysOfWeek.filter((_, i) => cells[5 + i].querySelector("input").checked)
        };
        staffData.push(entry);
      }
    });
    localStorage.setItem("staffData", JSON.stringify(staffData));
    alert("Staff data saved!");
    generateHeatmap();
    generateDailyGrids();
  });
}

function createInput(type, value = '', placeholder = '', checked = false) {
  const input = document.createElement("input");
  input.type = type;
  if (type === "checkbox") input.checked = checked;
  else {
    input.value = value;
    if (placeholder) input.placeholder = placeholder;
  }
  return input;
}

function wrapTd(content) {
  const td = document.createElement("td");
  td.appendChild(content);
  return td;
}

function setupCSVHandlers() {
  const exportBtn = document.createElement("button");
  const importBtn = document.createElement("button");
  const fileInput = document.createElement("input");

  exportBtn.textContent = "Export to CSV";
  importBtn.textContent = "Import from CSV";
  fileInput.type = "file";
  fileInput.accept = ".csv";
  fileInput.style.display = "none";

  document.body.appendChild(exportBtn);
  document.body.appendChild(importBtn);
  document.body.appendChild(fileInput);

  exportBtn.addEventListener("click", exportToCSV);
  importBtn.addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", importFromCSV);
}

function exportToCSV() {
  let csv = "Name,Start Time,Hours,Lunch,End Time," + daysOfWeek.join(",") + "\n";
  staffData.forEach(staff => {
    const row = [
      staff.name,
      staff.startTime,
      staff.hoursWorked,
      staff.hasLunch ? "Yes" : "No",
      staff.outTime,
      ...daysOfWeek.map(d => staff.days.includes(d) ? "Yes" : "No")
    ];
    csv += row.join(",") + "\n";
  });
  const blob = new Blob([csv], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "staff_schedule.csv";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

function importFromCSV(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function (event) {
    const rows = event.target.result.trim().split("\n").map(r => r.split(","));
    if (rows.length < 2) return;
    staffData.length = 0;
    rows.slice(1).forEach(row => {
      if (row.length >= 12) {
        const staff = {
          name: row[0].trim(),
          startTime: row[1].trim(),
          hoursWorked: parseInt(row[2], 10),
          hasLunch: row[3].trim() === "Yes",
          outTime: row[4].trim(),
          days: daysOfWeek.filter((d, i) => row[5 + i]?.trim() === "Yes")
        };
        staffData.push(staff);
      }
    });
    localStorage.setItem("staffData", JSON.stringify(staffData));
    alert("Staff schedule imported successfully!");
    window.location.reload();
  };
  reader.readAsText(file);
}

function isInShift(staff, hourStr, dayIdx) {
  const [startH, startM] = staff.startTime.split(":").map(Number);
  const [checkH, checkM] = hourStr.split(":").map(Number);
  const start = startH * 60 + startM;
  const shiftDuration = staff.hoursWorked * 60 + (staff.hasLunch ? 60 : 0);
  const end = start + shiftDuration;
  const check = checkH * 60 + checkM;
  return check >= start && check < Math.min(end, MINUTES_IN_DAY);
}

function isCarryover(staff, hourStr) {
  const [startH, startM] = staff.startTime.split(":").map(Number);
  const [checkH, checkM] = hourStr.split(":").map(Number);
  const start = startH * 60 + startM;
  const shiftDuration = staff.hoursWorked * 60 + (staff.hasLunch ? 60 : 0);
  const end = start + shiftDuration;
  const check = checkH * 60 + checkM;
  return end > MINUTES_IN_DAY && check < (end - MINUTES_IN_DAY);
}

function generateHeatmap() {
  const gridBody = document.getElementById("grid-body");
  const gridHeader = document.querySelector("#staffing-grid thead tr");
  gridBody.innerHTML = "";
  gridHeader.innerHTML = "";

  const hours = Array.from({ length: 48 }, (_, i) => `${String(Math.floor(i / 2)).padStart(2, '0')}:${i % 2 === 0 ? '00' : '30'}`);
  gridHeader.appendChild(Object.assign(document.createElement("th"), { textContent: "Day" }));
  hours.forEach(hour => gridHeader.appendChild(Object.assign(document.createElement("th"), { textContent: hour })));

  daysOfWeek.forEach((day, dayIdx) => {
    const row = document.createElement("tr");
    row.appendChild(Object.assign(document.createElement("td"), { textContent: day }));

    hours.forEach(hour => {
      const cell = document.createElement("td");
      const count = staffData.filter(staff => {
        const isWorking = staff.days.includes(day) && isInShift(staff, hour, dayIdx);
        const prevDay = daysOfWeek[(dayIdx + 6) % 7];
        const carryover = staff.days.includes(prevDay) && isCarryover(staff, hour);
        return isWorking || carryover;
      }).length;

      const colorScale = [
        "rgba(255,0,0,1)", "rgba(255,69,0,1)", "rgba(255,140,0,1)",
        "rgba(255,200,0,1)", "rgba(255,255,0,1)", "rgba(173,255,47,1)",
        "rgba(0,255,0,1)", "rgba(0,200,150,1)", "rgba(0,150,200,1)",
        "rgba(0,100,255,1)", "rgba(0,0,255,1)"
      ];
      const color = colorScale[Math.min(count, 10)];
      const fontColor = count >= 9 ? "darkgrey" : "black";
      cell.style.backgroundColor = color;
      cell.style.color = fontColor;
      cell.textContent = count;
      row.appendChild(cell);
    });

    gridBody.appendChild(row);
  });
}

function generateDailyGrids() {
  const scheduleContainer = document.getElementById("daily-schedules");
  scheduleContainer.innerHTML = "";

  const timeSlots = Array.from({ length: 48 }, (_, i) => `${String(Math.floor(i / 2)).padStart(2, "0")}:${i % 2 === 0 ? "00" : "30"}`);
  const nextDayMap = {
    "Monday": "Tuesday", "Tuesday": "Wednesday", "Wednesday": "Thursday",
    "Thursday": "Friday", "Friday": "Saturday", "Saturday": "Sunday", "Sunday": "Monday"
  };

  const scheduleTables = {};
  daysOfWeek.forEach(day => {
    const heading = document.createElement("h2");
    heading.textContent = `${day} Schedule`;
    scheduleContainer.appendChild(heading);

    const table = document.createElement("table");
    table.classList.add("schedule-table");

    const thead = document.createElement("thead");
    const headerRow = document.createElement("tr");
    headerRow.innerHTML = `<th>Name</th>` + timeSlots.map(slot => `<th>${slot}</th>`).join("");
    thead.appendChild(headerRow);
    table.appendChild(thead);

    const tbody = document.createElement("tbody");
    table.appendChild(tbody);
    scheduleContainer.appendChild(table);
    scheduleTables[day] = tbody;
  });

  const carryoverShifts = {};

  staffData.forEach(staff => {
    const [startH, startM] = staff.startTime.split(":").map(Number);
    const startMinutes = startH * 60 + startM;
    const shiftDuration = staff.hoursWorked * 60 + (staff.hasLunch ? 60 : 0);
    const endMinutes = startMinutes + shiftDuration;

    staff.days.forEach(day => {
      const tbody = scheduleTables[day];
      const row = document.createElement("tr");

      const nameCell = document.createElement("td");
      nameCell.textContent = staff.name;
      row.appendChild(nameCell);

      const effectiveEnd = Math.min(endMinutes, 1440);

      timeSlots.forEach(slot => {
        const cell = document.createElement("td");
        const [slotH, slotM] = slot.split(":").map(Number);
        const slotMinutes = slotH * 60 + slotM;
        let status = "0";
        if (slotMinutes >= startMinutes && slotMinutes < effectiveEnd) status = "1";
        cell.textContent = status;
        cell.setAttribute("data-status", status);
        cell.classList.add("time-slot");
        row.appendChild(cell);
      });

      tbody.appendChild(row);

      if (endMinutes > 1440) {
        const nextDay = nextDayMap[day];
        const carryoverEnd = endMinutes - 1440;
        if (!carryoverShifts[nextDay]) carryoverShifts[nextDay] = [];
        carryoverShifts[nextDay].push({ name: staff.name, endMinutes: carryoverEnd });
      }
    });
  });

  Object.keys(carryoverShifts).forEach(day => {
    const tbody = scheduleTables[day];
    carryoverShifts[day].forEach(shift => {
      const row = document.createElement("tr");
      const nameCell = document.createElement("td");
      nameCell.textContent = `${shift.name} (Carryover)`;
      row.appendChild(nameCell);

      timeSlots.forEach(slot => {
        const cell = document.createElement("td");
        const [slotH, slotM] = slot.split(":").map(Number);
        const slotMinutes = slotH * 60 + slotM;
        let status = "0";
        if (slotMinutes >= 0 && slotMinutes < shift.endMinutes) status = "1";
        cell.textContent = status;
        cell.setAttribute("data-status", status);
        cell.classList.add("time-slot");
        row.appendChild(cell);
      });

      tbody.appendChild(row);
    });
  });
}