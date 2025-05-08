function getTimeSlots() {
  const showHalfHours = document.getElementById("half-hour-toggle")?.checked;
  return Array.from({ length: 48 }, (_, i) =>
    `${String(Math.floor(i / 2)).padStart(2, "0")}:${i % 2 === 0 ? "00" : "30"}`
  ).filter(slot => showHalfHours || slot.endsWith(":00"));
}

document.addEventListener('DOMContentLoaded', () => {
  const darkModeToggle = document.getElementById('dark-mode-toggle');

  // Check for user preference in localStorage
  if (localStorage.getItem('darkMode') === 'enabled') {
    document.body.classList.add('dark-mode');
  }

  // Toggle dark mode on button click
  darkModeToggle.addEventListener('click', () => {
    document.body.classList.toggle('dark-mode');

    // Store preference in localStorage
    if (document.body.classList.contains('dark-mode')) {
      localStorage.setItem('darkMode', 'enabled');
    } else {
      localStorage.setItem('darkMode', 'disabled');
    }
  });
});

// Load saved staff data or initialize an empty array
const staffData = JSON.parse(localStorage.getItem('staffData')) || [];
const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

document.addEventListener('DOMContentLoaded', () => {
  const staffTableBody = document.querySelector('#staff-input-table tbody');
  const saveButton = document.getElementById('save-staff');

  // Populate staff table with saved data or initialize 30 blank rows
  for (let i = 0; i < 30; i++) {
    const row = document.createElement('tr');
    const staffEntry = staffData[i] || { name: '', startTime: '', hoursWorked: '', hasLunch: false, outTime: '', days: [] };

    // Name column
    const nameCell = document.createElement('td');
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.placeholder = `Staff ${i + 1}`;
    nameInput.value = staffEntry.name;
    nameCell.appendChild(nameInput);
    row.appendChild(nameCell);

    // Start Time column
    const startTimeCell = document.createElement('td');
    const startTimeInput = document.createElement('input');
    startTimeInput.type = 'time';
    startTimeInput.value = staffEntry.startTime;
    startTimeCell.appendChild(startTimeInput);
    row.appendChild(startTimeCell);

    // Hours Worked column
    const hoursWorkedCell = document.createElement('td');
    const hoursWorkedInput = document.createElement('input');
    hoursWorkedInput.type = 'number';
    hoursWorkedInput.min = 1;
    hoursWorkedInput.max = 24;
    hoursWorkedInput.value = staffEntry.hoursWorked;
    hoursWorkedCell.appendChild(hoursWorkedInput);
    row.appendChild(hoursWorkedCell);

    // Lunch column
    const lunchCell = document.createElement('td');
    const lunchInput = document.createElement('input');
    lunchInput.type = 'checkbox';
    lunchInput.checked = staffEntry.hasLunch;
    lunchCell.appendChild(lunchInput);
    row.appendChild(lunchCell);

    // Out Time column (read-only)
    const outTimeCell = document.createElement('td');
    const outTimeDisplay = document.createElement('input');
    outTimeDisplay.type = 'text';
    outTimeDisplay.readOnly = true;
    outTimeDisplay.value = staffEntry.outTime;
    outTimeCell.appendChild(outTimeDisplay);
    row.appendChild(outTimeCell);

    // Update Out Time dynamically
    [startTimeInput, hoursWorkedInput, lunchInput].forEach(input => {
      input.addEventListener('input', () => {
        if (startTimeInput.value && hoursWorkedInput.value) {
          const [hourStart, minuteStart] = startTimeInput.value.split(':').map(Number);
          const shiftDuration = parseInt(hoursWorkedInput.value, 10) * 60 + (lunchInput.checked ? 60 : 0);
          const endTime = hourStart * 60 + minuteStart + shiftDuration;

          const hourEnd = Math.floor(endTime / 60) % 24;
          const minuteEnd = endTime % 60;

          outTimeDisplay.value = `${String(hourEnd).padStart(2, '0')}:${String(minuteEnd).padStart(2, '0')}`;
        } else {
          outTimeDisplay.value = '';
        }
      });
    });

    // Day selection checkboxes
    daysOfWeek.forEach(day => {
      const dayCell = document.createElement('td');
      const dayToggle = document.createElement('input');
      dayToggle.type = 'checkbox';
      dayToggle.checked = staffEntry.days.includes(day);
      dayCell.appendChild(dayToggle);
      row.appendChild(dayCell);
    });

    staffTableBody.appendChild(row);
  }

  // Save staff data and update heatmap
  saveButton.addEventListener('click', () => {
    const rows = Array.from(staffTableBody.querySelectorAll('tr'));
    staffData.length = 0;

    rows.forEach((row, index) => {
      const cells = row.querySelectorAll('td');
      const name = cells[0].querySelector('input').value.trim();
      const startTime = cells[1].querySelector('input').value;
      const hoursWorked = parseInt(cells[2].querySelector('input').value, 10);
      const hasLunch = cells[3].querySelector('input').checked;
      const outTime = cells[4].querySelector('input').value;

      if (name && startTime && hoursWorked && outTime) {
        const staffEntry = { name, startTime, hoursWorked, hasLunch, outTime, days: [] };

        daysOfWeek.forEach((day, index) => {
          if (cells[5 + index].querySelector('input').checked) {
            staffEntry.days.push(day);
          }
        });

        staffData.push(staffEntry);
      }
    });

    alert('Staff data saved!');
    generateHeatmap();
    generateDailyGrids();
  });
});

// Generate the heatmap table
function generateHeatmap() {
  const gridBody = document.getElementById('grid-body');
  gridBody.innerHTML = ''; // Clear previous heatmap

  const gridHeader = document.querySelector('#staffing-grid thead tr');
  gridHeader.innerHTML = ''; // Clear headers

  const hours = getTimeSlots();

  // Add "Day" header
  const dayHeader = document.createElement('th');
  dayHeader.textContent = 'Day';
  gridHeader.appendChild(dayHeader);

  // Add headers for time intervals
  hours.forEach(hour => {
    const timeHeader = document.createElement('th');
    timeHeader.textContent = hour;
    gridHeader.appendChild(timeHeader);
  });

  // Generate rows for each day
  daysOfWeek.forEach((day, dayIndex) => {
    const row = document.createElement('tr');
    const dayCell = document.createElement('td');
    dayCell.textContent = day;
    row.appendChild(dayCell);

    hours.forEach(hour => {
      const cell = document.createElement('td');

      // Count staff working during the hour on this day
      const count = staffData.filter(staff => {
        const isWorkingOnDay = staff.days.includes(day);
        const previousDayIndex = (dayIndex - 1 + 7) % 7; // Wrap around for previous day
        const previousDay = daysOfWeek[previousDayIndex];

        // Check if staff is working on the given day or the next day due to a carryover
        return (
          (isWorkingOnDay && isTimeWithinShift(staff.startTime, staff.hoursWorked, staff.hasLunch, hour, dayIndex)) ||
          (staff.days.includes(previousDay) && isCarryoverShift(staff.startTime, staff.hoursWorked, staff.hasLunch, hour, previousDayIndex))
        );
      }).length;


// Apply color scale based on count
let color;
let fontColor = 'black'; // Default font color

if (count === 0) {
  color = `rgba(255, 0, 0, 1)`; // Red for 0
} else if (count === 1) {
  color = `rgba(255, 69, 0, 1)`; // Orange-Red
} else if (count === 2) {
  color = `rgba(255, 140, 0, 1)`; // Dark Orange
} else if (count === 3) {
  color = `rgba(255, 200, 0, 1)`; // Yellow-Orange
} else if (count === 4) {
  color = `rgba(255, 255, 0, 1)`; // Yellow
} else if (count === 5) {
  color = `rgba(173, 255, 47, 1)`; // Yellow-Green
} else if (count === 6) {
  color = `rgba(0, 255, 0, 1)`; // Green
} else if (count === 7) {
  color = `rgba(0, 200, 150, 1)`; // Green-Blue
} else if (count === 8) {
  color = `rgba(0, 150, 200, 1)`; // Cyan
} else if (count === 9) {
  color = `rgba(0, 100, 255, 1)`; // Light Blue
  fontColor = 'darkgrey'; // Change font color for 9+
} else if (count >= 10) {
  color = `rgba(0, 0, 255, 1)`; // Blue for 10+
  fontColor = 'darkgrey'; // Change font color for 10+
}

// Apply styles to the heatmap cell
cell.style.backgroundColor = color;
cell.style.color = fontColor; // Updates font color dynamically
cell.textContent = count;
      row.appendChild(cell);
    });

    gridBody.appendChild(row);
  });
}

// Helper function to check if time is within the shift on the same day
function isTimeWithinShift(startTime, hoursWorked, hasLunch, hour, dayIndex) {
  const [hourStart, minuteStart] = startTime.split(':').map(Number);
  const [hourCheck, minuteCheck] = hour.split(':').map(Number);

  const start = hourStart * 60 + minuteStart;
  const shiftDuration = hoursWorked * 60 + (hasLunch ? 60 : 0); // Add 1 hour if lunch is included
  const end = start + shiftDuration;
  const check = hourCheck * 60 + minuteCheck;

  return check >= start && check < Math.min(end, 1440); // Cap the end time at midnight
}

// Helper function to check if the shift carries over to the next day
function isCarryoverShift(startTime, hoursWorked, hasLunch, hour, dayIndex) {
  const [hourStart, minuteStart] = startTime.split(':').map(Number);
  const [hourCheck, minuteCheck] = hour.split(':').map(Number);

  const start = hourStart * 60 + minuteStart;
  const shiftDuration = hoursWorked * 60 + (hasLunch ? 60 : 0); // Add 1 hour if lunch is included
  const end = start + shiftDuration;
  const check = hourCheck * 60 + minuteCheck;

  return end > 1440 && check < (end - 1440); // Check if time falls after midnight on the next day
}
document.addEventListener('DOMContentLoaded', () => {
  const staffTableBody = document.querySelector('#staff-input-table tbody');
  const saveButton = document.getElementById('save-staff');
  const exportButton = document.createElement('button');
  const importButton = document.createElement('button');
  const fileInput = document.createElement('input');

  // Configure CSV buttons
  exportButton.textContent = "Export to CSV";
  importButton.textContent = "Import from CSV";
  fileInput.type = "file";
  fileInput.accept = ".csv";
  fileInput.style.display = "none";

  document.body.appendChild(exportButton);
  document.body.appendChild(importButton);
  document.body.appendChild(fileInput);

  exportButton.addEventListener("click", exportToCSV);
  importButton.addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", importFromCSV);

  //populateStaffTable();
  saveButton.addEventListener('click', saveStaffData);
  generateHeatmap();
  generateDailyGrids(); 
});

// Export data to CSV
function exportToCSV() {
  let csvContent = "Name,Start Time,Hours,Lunch,End Time," + daysOfWeek.join(",") + "\n";

  staffData.forEach(staff => {
    const row = [
      staff.name,
      staff.startTime,
      staff.hoursWorked,
      staff.hasLunch ? "Yes" : "No",
      staff.endTime,
      ...daysOfWeek.map(day => (staff.days.includes(day) ? "Yes" : "No"))
    ];
    csvContent += row.join(",") + "\n";
  });

  const blob = new Blob([csvContent], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "staff_schedule.csv";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

function importFromCSV(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function (e) {
    const csvRows = e.target.result.trim().split("\n").map(row => row.split(","));
    if (csvRows.length < 2) return; // Ensure valid CSV format

    staffData.length = 0;
    csvRows.slice(1).forEach(row => {
      if (row.length >= 12) { // Ensure all expected fields are present
        const staffEntry = {
          name: row[0].trim(),
          startTime: row[1].trim(),
          hoursWorked: parseInt(row[2], 10),
          hasLunch: row[3].trim() === "Yes",
          endTime: calculateEndTime(row[1].trim(), parseInt(row[2], 10), row[3].trim() === "Yes"),
          days: daysOfWeek.filter((day, index) => row[5 + index]?.trim() === "Yes")
        };
        staffData.push(staffEntry);
      }
    });

    localStorage.setItem("staffData", JSON.stringify(staffData));
    forceEndTimeRecalc();
    //populateStaffTable();
    generateHeatmap();
    generateDailyGrids();
    alert("Staff schedule imported successfully!");
    
    // Reload the page after import
    window.location.reload();
  };

  reader.readAsText(file);
}

function generateDailyGrids() {
  const scheduleContainer = document.getElementById("daily-schedules");
  scheduleContainer.innerHTML = "";

  const timeSlots = getTimeSlots();
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

document.addEventListener("DOMContentLoaded", () => {
  const loadTestBtn = document.getElementById("load-test");
  if (loadTestBtn) {
    loadTestBtn.addEventListener("click", () => {
      const csv = `Name,Start Time,Hours,Lunch,End Time,Monday,Tuesday,Wednesday,Thursday,Friday,Saturday,Sunday
Bob Sacamano,06:00,12,No,18:00,Yes,Yes,Yes,No,No,No,No
Tim Whatley,18:00,12,No,06:00,No,Yes,Yes,Yes,No,No,No
Lloyd Braun,18:00,12,No,06:00,No,No,Yes,Yes,Yes,No,No
Jackie Chiles,06:00,12,No,18:00,Yes,Yes,No,No,No,No,Yes
Izzy Mandelbaum,06:00,12,No,18:00,No,No,No,Yes,Yes,Yes,No
Babu Bhatt,18:00,12,No,06:00,Yes,Yes,Yes,No,No,No,No
Jean-Paul Jean-Paul,18:00,12,No,06:00,No,No,No,No,Yes,Yes,Yes
Bob Cobb,18:00,12,No,06:00,No,No,No,No,No,Yes,No
David Puddy,18:00,12,No,06:00,Yes,Yes,No,No,No,No,Yes
Sue Ellen Mischke,18:00,12,No,06:00,Yes,Yes,Yes,No,No,No,No
Frank Costanza,06:00,12,No,18:00,No,Yes,Yes,Yes,No,No,No
Kenny Bania,18:00,12,No,06:00,No,No,Yes,Yes,Yes,No,No
Mickey Abbott,18:00,12,No,06:00,No,No,No,Yes,Yes,Yes,No
Joe Davola,06:00,12,No,18:00,No,No,No,No,No,No,No
Sidra Holland,06:00,12,No,18:00,No,No,No,No,Yes,Yes,Yes
Jacopo Peterman,06:00,12,No,18:00,Yes,No,No,No,No,Yes,Yes
Yev Kassem,06:00,12,No,18:00,Yes,Yes,No,No,No,No,Yes
Matt Wilhelm,18:00,12,No,06:00,Yes,Yes,Yes,No,No,No,No
Justin Pitt,06:00,12,No,18:00,No,Yes,Yes,Yes,No,No,No
Russell Dalrymple,06:00,12,No,18:00,No,No,Yes,Yes,Yes,No,No
Jack Klompus,06:00,12,No,18:00,No,No,Yes,Yes,Yes,No,No
Art Vandelay,18:00,12,No,06:00,No,No,No,No,Yes,Yes,Yes
Peter von Nostrand,06:00,12,No,19:00,Yes,No,No,No,No,Yes,Yes`;

      const blob = new Blob([csv], { type: "text/csv" });
      const file = new File([blob], "test_staff_data.csv", { type: "text/csv" });

      const fileInput = document.createElement("input");
      fileInput.type = "file";
      fileInput.style.display = "none";
      document.body.appendChild(fileInput);

      Object.defineProperty(fileInput, 'files', {
        value: [file],
        writable: false,
      });

      const event = new Event("change");
      fileInput.addEventListener("change", () => {
        importFromCSV(event);
      });
      fileInput.dispatchEvent(event);
    });
  }
});

document.addEventListener("DOMContentLoaded", () => {
  const instructions = document.getElementById("instructions");
  if (instructions && instructions.open && !localStorage.getItem("hasVisited")) {
    setTimeout(() => {
      instructions.open = false;
    }, 5000);
  }
});

document.addEventListener("DOMContentLoaded", () => {
  const instructions = document.getElementById("instructions");
  if (instructions && instructions.open) {
    setTimeout(() => {
      instructions.open = false;
    }, 300000); // 5 minutes
  }
});

document.addEventListener("DOMContentLoaded", () => {
  const instructions = document.getElementById("instructions");
  if (instructions) {
    instructions.open = true;
    setTimeout(() => {
      instructions.open = false;
    }, 10000); // 10 seconds
  }
});

document.addEventListener("DOMContentLoaded", () => {
  const tbody = document.getElementById("staff-table-body");
  const rows = Array.from(tbody?.querySelectorAll("tr") || []);
  const hasNames = rows.some(row => {
    const name = row.querySelector("td input[type='text']")?.value.trim();
    return !!name;
  });

  if (hasNames) {
    generateHeatmap();
    generateDailyGrids();
  }
});

document.addEventListener("DOMContentLoaded", () => {
  const toggle = document.getElementById("half-hour-toggle");
  if (toggle) {
    toggle.checked = false; // default to unchecked
    toggle.addEventListener("change", () => {
      generateHeatmap();
      generateDailyGrids();
    });
  }

  generateHeatmap();
  generateDailyGrids();
});

document.addEventListener("DOMContentLoaded", () => {
  // Clear Staff
  const clearBtn = document.getElementById("clear-staff");
  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      localStorage.removeItem("staffData");
      alert("Staff data cleared. Reloading...");
      location.reload();
    });
  }

  // Export CSV
  const exportBtn = document.getElementById("export-csv");
  if (exportBtn) {
    exportBtn.addEventListener("click", exportToCSV);
  }

  // Import CSV
  const importBtn = document.getElementById("import-csv");
  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.accept = ".csv";
  fileInput.style.display = "none";
  document.body.appendChild(fileInput);

  if (importBtn) {
    importBtn.addEventListener("click", () => fileInput.click());
  }

  fileInput.addEventListener("change", importFromCSV);
});
updateOutTimes();

function updateOutTimes() {
  const rows = document.querySelectorAll("#staff-input-table tbody tr");
  rows.forEach(row => {
    const inputs = row.querySelectorAll("td input");
    const startTimeInput = inputs[1];
    const hoursWorkedInput = inputs[2];
    const lunchInput = inputs[3];
    const outTimeDisplay = inputs[4];

    if (startTimeInput && hoursWorkedInput && outTimeDisplay) {
      const [h, m] = startTimeInput.value.split(":").map(Number);
      const hours = parseInt(hoursWorkedInput.value, 10);
      const hasLunch = lunchInput.checked;
      if (!isNaN(h) && !isNaN(m) && !isNaN(hours)) {
        let duration = hours * 60 + (hasLunch ? 60 : 0);
        let end = h * 60 + m + duration;
        const hourEnd = Math.floor(end / 60) % 24;
        const minEnd = end % 60;
        outTimeDisplay.value = `${String(hourEnd).padStart(2, '0')}:${String(minEnd).padStart(2, '0')}`;
      } else {
        outTimeDisplay.value = "";
      }
    }
  });
}

function buildStaffTable() {
  const tbody = document.querySelector("#staff-input-table tbody");
  const saveBtn = document.getElementById("save-staff");
  tbody.innerHTML = "";

  for (let i = 0; i < 30; i++) {
    const row = document.createElement("tr");
    const staffEntry = staffData[i] || { name: '', startTime: '', hoursWorked: '', hasLunch: false, outTime: '', days: [] };

    const nameInput = createInput("text", staffEntry.name, `Staff ${i + 1}`);
    row.appendChild(wrapTd(nameInput));

    const startTimeInput = createInput("time", staffEntry.startTime);
    row.appendChild(wrapTd(startTimeInput));

    const hoursWorkedInput = createInput("number", staffEntry.hoursWorked);
    hoursWorkedInput.min = 1;
    hoursWorkedInput.max = 24;
    row.appendChild(wrapTd(hoursWorkedInput));

    const lunchInput = createInput("checkbox", '', '', staffEntry.hasLunch);
    row.appendChild(wrapTd(lunchInput));

    const outTimeInput = createInput("text", staffEntry.outTime);
    outTimeInput.readOnly = true;
    row.appendChild(wrapTd(outTimeInput));

    // Auto update on input changes
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

  saveBtn?.addEventListener("click", () => {
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
    forceEndTimeRecalc();
    generateHeatmap();
    generateDailyGrids();
    alert("Schedule updated.");
  });

  updateOutTimes();
}

function forceEndTimeRecalc() {
  const rows = document.querySelectorAll("#staff-input-table tbody tr");
  rows.forEach(row => {
    const inputs = row.querySelectorAll("td input");
    const startTimeInput = inputs[1];
    const lunchCheckbox = inputs[3];
    if (startTimeInput?.value && lunchCheckbox) {
      const originalState = lunchCheckbox.checked;
      lunchCheckbox.checked = !originalState;
      setTimeout(() => {
        lunchCheckbox.checked = originalState;
        lunchCheckbox.dispatchEvent(new Event("input"));
      }, 500);
    }
  });
}

function calculateEndTime(startTime, hoursWorked, hasLunch) {
  const [h, m] = startTime.split(":").map(Number);
  let duration = hoursWorked * 60 + (hasLunch ? 60 : 0);
  let end = h * 60 + m + duration;
  const hourEnd = Math.floor(end / 60) % 24;
  const minEnd = end % 60;
  return `${String(hourEnd).padStart(2, '0')}:${String(minEnd).padStart(2, '0')}`;
}

function calculateEndTime(startTime, hoursWorked, hasLunch) {
  const [h, m] = startTime.split(":").map(Number);
  let duration = hoursWorked * 60 + (hasLunch ? 60 : 0);
  let end = h * 60 + m + duration;
  const hourEnd = Math.floor(end / 60) % 24;
  const minEnd = end % 60;
  return `${String(hourEnd).padStart(2, '0')}:${String(minEnd).padStart(2, '0')}`;
}

document.addEventListener("DOMContentLoaded", () => {
  const instructions = document.getElementById("instructions");
  const showToggle = document.getElementById("show-on-load");

  if (instructions && showToggle) {
    const showPref = localStorage.getItem("showInstructions");
    if (showPref === "false") {
      instructions.open = false;
      showToggle.checked = false;
    }

    showToggle.addEventListener("change", () => {
      localStorage.setItem("showInstructions", showToggle.checked ? "true" : "false");
    });
  }
});