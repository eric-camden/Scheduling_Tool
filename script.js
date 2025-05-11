// Helper: convert to 12-hour time format with AM/PM
function to12HourFormat(hour24, minute) {
  const period = hour24 >= 12 ? 'PM' : 'AM';
  let hour12 = hour24 % 12;
  if (hour12 === 0) hour12 = 12;
  return `${hour12}:${minute.toString().padStart(2, '0')} ${period}`;
}




// Generate time slots (half-hour optional)
function getTimeSlots() {
  const showHalfHours = document.getElementById('half-hour-toggle')?.checked;
  return Array.from({ length: 48 }, (_, i) => {
    const hh = String(Math.floor(i / 2)).padStart(2, '0');
    const mm = i % 2 === 0 ? '00' : '30';
    return `${hh}:${mm}`;
  }).filter(slot => showHalfHours || slot.endsWith(':00'));
}



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
  color = `rgba(255, 0, 0, 0.6)`; // Red for 0
} else if (count === 1) {
  color = `rgba(255, 69, 0, 0.6)`; // Orange-Red
} else if (count === 2) {
  color = `rgba(255, 140, 0, 0.6)`; // Dark Orange
} else if (count === 3) {
  color = `rgba(255, 200, 0, 0.6)`; // Yellow-Orange
} else if (count === 4) {
  color = `rgba(255, 255, 0, 0.6)`; // Yellow
} else if (count === 5) {
  color = `rgba(173, 255, 47, 0.6)`; // Yellow-Green
} else if (count === 6) {
  color = `rgba(0, 255, 0, 0.6)`; // Green
} else if (count === 7) {
  color = `rgba(0, 200, 150, 0.6)`; // Green-Blue
} else if (count === 8) {
  color = `rgba(0, 150, 200, 0.6)`; // Cyan
} else if (count === 9) {
  color = `rgba(0, 100, 255, 0.6)`; // Light Blue
  fontColor = 'darkgrey'; // Change font color for 9+
} else if (count >= 10) {
  color = `rgba(0, 0, 255, 0.6)`; // Blue for 10+
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


// Update all out-time displays in the table
function updateOutTimes() {
  document.querySelectorAll('#staff-input-table tbody tr').forEach(row => {
    const inputs = row.querySelectorAll('input');
    const start = inputs[1].value;
    const hours = parseInt(inputs[2].value, 10);
    const lunch = inputs[3].checked;
    const outDisplay = inputs[4];
    if (start && !isNaN(hours)) {
      outDisplay.value = calculateEndTime(start, hours, lunch).display;
    } else {
      outDisplay.value = '';
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
    updateOutTimes();
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


// Calculate end time: returns both raw (24h) and display (12h) formats
function calculateEndTime(startTime, hoursWorked, hasLunch) {
  const [h, m] = startTime.split(':').map(Number);
  const duration = hoursWorked * 60 + (hasLunch ? 60 : 0);
  const endMinutes = h * 60 + m + duration;
  const hourEnd = Math.floor(endMinutes / 60) % 24;
  const minEnd = endMinutes % 60;
  return {
    raw: `${String(hourEnd).padStart(2, '0')}:${String(minEnd).padStart(2, '0')}`,
    display: to12HourFormat(hourEnd, minEnd)
  };
}


// Attach listeners to a row's inputs
function attachRowListeners(row) {
  row.querySelectorAll('input[type="time"], input[type="number"], input[type="checkbox"]').forEach(input => {
    ['input','change'].forEach(evt => input.addEventListener(evt, updateOutTimes));
  });
}

// Render the input table based on staffData
function renderStaffTable() {
  const tbody = document.querySelector('#staff-input-table tbody');
  tbody.innerHTML = '';
  for (let i = 0; i < 30; i++) {
    const data = staffData[i] || { name:'', startTime:'', hoursWorked:'', hasLunch:false, outTime:'', days:[] };
    const row = document.createElement('tr');
    ['text','time','number','checkbox','text'].forEach((type, idx) => {
      const cell = document.createElement('td');
      const inp = document.createElement('input');
      inp.type = type;
      if (type === 'checkbox') inp.checked = data.hasLunch;
      else if (idx === 0) inp.placeholder = `Staff ${i+1}`;
      inp.value = type==='checkbox'?undefined:data[['name','startTime','hoursWorked','outTime'][idx]];
      if (type==='text' && idx===4) inp.readOnly = true;
      cell.appendChild(inp);
      row.appendChild(cell);
    });
    daysOfWeek.forEach(d => {
      const cell = document.createElement('td');
      const chk = document.createElement('input');
      chk.type = 'checkbox';
      chk.checked = data.days.includes(d);
      cell.appendChild(chk);
      row.appendChild(cell);
    });
    attachRowListeners(row);
    tbody.appendChild(row);
  }
  updateOutTimes();
}

// CSV Import
function importFromCSV(event) {
  const file = event.target.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    const rows = e.target.result.trim().split('\n').map(r => r.split(','));
    staffData.length = 0;
    rows.slice(1).forEach(cells => {
      if (cells.length >= 12) {
        const [name,start,hours,lunch,,...weekday] = cells;
        const hw = parseInt(hours,10);
        const hasLunch = lunch.trim()==='Yes';
        const {raw,display} = calculateEndTime(start.trim(),hw,hasLunch);
        staffData.push({name:name.trim(),startTime:start.trim(),hoursWorked:hw,hasLunch,endTime:raw,outTime:display,days:daysOfWeek.filter((_,i)=>weekday[i]?.trim()==='Yes')});
      }
    });
    localStorage.setItem('staffData',JSON.stringify(staffData));
    renderStaffTable(); generateHeatmap(); generateDailyGrids(); updateOutTimes();
    alert('Imported successfully');
  };
  reader.readAsText(file);
}

// CSV Export
function exportToCSV() {
  const header = ['Name','Start Time','Hours','Lunch','End Time',...daysOfWeek].join(',');
  const csv = [header,...staffData.map(s=>[s.name,s.startTime,s.hoursWorked,s.hasLunch?'Yes':'No',s.endTime,...daysOfWeek.map(d=>s.days.includes(d)?'Yes':'No')].join(','))].join('\n');
  const blob = new Blob([csv],{type:'text/csv'});
  const a = document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='staff_schedule.csv'; a.click();
}




// Heatmap & Daily grid generation remain unchanged

// ─── On load initialization ───────────────────────────────────────
const daysOfWeek = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
let staffData  = JSON.parse(localStorage.getItem('staffData')) || [];

document.addEventListener('DOMContentLoaded', () => {
  // Create shared fileInput for import & test data
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = '.csv';
  fileInput.style.display = 'none';
  document.body.appendChild(fileInput);
  fileInput.addEventListener('change', importFromCSV);

  // 1) Dark mode toggle
  const darkToggle = document.getElementById('dark-mode-toggle');
  if (localStorage.getItem('darkMode') === 'enabled') document.body.classList.add('dark-mode');
  darkToggle.addEventListener('click', () => {
    const enabled = document.body.classList.toggle('dark-mode');
    localStorage.setItem('darkMode', enabled ? 'enabled' : 'disabled');
  });

  // 2) Instructions panel toggle
  const instr = document.getElementById('instructions');
  const showToggle = document.getElementById('show-on-load');
  if (instr && showToggle) {
    const pref = localStorage.getItem('showInstructions');
    instr.open = pref !== 'false';
    showToggle.checked = pref !== 'false';
    showToggle.addEventListener('change', () => {
      localStorage.setItem('showInstructions', showToggle.checked ? 'true' : 'false');
    });
  }

  // 3) Half-hour heatmap toggle
  document.getElementById('half-hour-toggle').addEventListener('change', () => {
    generateHeatmap();
    generateDailyGrids();
  });

  // 4) Clear staff data
  document.getElementById('clear-staff').addEventListener('click', () => {
    localStorage.removeItem('staffData');
    alert('Staff data cleared.');
    location.reload();
  });

  // 5) Load test data
  const loadTestBtn = document.getElementById('load-test');
  loadTestBtn?.addEventListener('click', () => {
    const csv = `Name,Start Time,Hours,Lunch,End Time,Monday,Tuesday,Wednesday,Thursday,Friday,Saturday,Sunday
Bob Sacamano,06:30,10,Yes,17:30,Yes,Yes,Yes,Yes,Yes,No,No
Tim Whatley,07:00,10,Yes,18:00,Yes,Yes,Yes,Yes,Yes,No,No
Lloyd Braun,10:30,10,Yes,21:30,No,No,Yes,Yes,Yes,Yes,No
Jackie Chiles,08:00,10,Yes,19:00,Yes,Yes,Yes,No,No,No,Yes
Izzy Mandelbaum,11:00,10,Yes,22:00,Yes,Yes,Yes,No,No,No,Yes
Babu Bhatt,11:00,10,Yes,22:00,No,No,Yes,Yes,Yes,Yes,No
Jean-Paul Jean-Paul,08:00,10,Yes,19:00,No,No,Yes,Yes,Yes,Yes,No
Bob Cobb,23:30,10,Yes,10:30,No,Yes,Yes,Yes,Yes,Yes,No
David Puddy,21:30,10,Yes,08:30,No,No,Yes,Yes,Yes,Yes,No
Sue Ellen Mischke,21:30,10,Yes,08:30,Yes,Yes,Yes,No,No,No,Yes
Frank Costanza,23:00,10,Yes,10:00,Yes,No,Yes,Yes,No,No,Yes
Kenny Bania,07:00,10,Yes,18:00,Yes,No,No,No,Yes,Yes,Yes
Mickey Abbott,10:30,10,Yes,21:30,Yes,Yes,Yes,No,No,No,Yes
Joe Davola,05:00,10,Yes,16:00,Yes,Yes,Yes,No,No,No,Yes
Sidra Holland,07:00,10,Yes,18:00,Yes,Yes,Yes,Yes,Yes,No,No
Jacopo Peterman,12:00,10,Yes,23:00,Yes,Yes,Yes,No,No,No,Yes
Yev Kassem,21:30,10,Yes,08:30,Yes,Yes,Yes,No,No,No,Yes
Matt Wilhelm,05:00,10,Yes,16:00,Yes,Yes,Yes,No,No,No,Yes
Justin Pitt,12:00,10,Yes,23:00,Yes,Yes,Yes,No,No,No,Yes
Russell Dalrymple,21:30,10,Yes,08:30,No,No,Yes,Yes,Yes,Yes,No
Jack Klompus,06:30,10,Yes,17:30,Yes,Yes,Yes,No,No,No,Yes
Art Vandelay,07:00,10,Yes,18:00,No,No,Yes,Yes,Yes,Yes,No
Peter von Nostrand,10:30,10,Yes,21:30,Yes,Yes,Yes,No,No,No,Yes`;
    const blob = new Blob([csv], { type: 'text/csv' });
    const fakeFile = new File([blob], 'test_staff_data.csv', { type: 'text/csv' });
    // Override fileInput.files to include our fake file
    Object.defineProperty(fileInput, 'files', { value: [fakeFile] });
    fileInput.dispatchEvent(new Event('change'));
  });

  // 6) CSV import/export & Save
  document.getElementById('import-csv').addEventListener('click', () => fileInput.click());
  document.getElementById('export-csv').addEventListener('click', exportToCSV);
  document.getElementById('save-staff').addEventListener('click', () => {
    // 1) make sure all Out-Time inputs are up-to-date
    updateOutTimes();

    // 2) read every row of the staff table into a fresh array
    const rows = document.querySelectorAll('#staff-input-table tbody tr');
    const newData = [];
    rows.forEach(row => {
      const inputs = row.querySelectorAll('input');
      const name       = inputs[0].value.trim();
      const startTime  = inputs[1].value;
      const hoursWorked= parseInt(inputs[2].value, 10);
      const hasLunch   = inputs[3].checked;
      const outTime    = inputs[4].value;
      // daysOfWeek is your [ "Monday", …, "Sunday" ] array
      const days = daysOfWeek.filter((_, idx) => inputs[5 + idx].checked);

      // only keep fully-filled rows
      if (name && startTime && hoursWorked && outTime) {
        newData.push({ name, startTime, hoursWorked, hasLunch, outTime, days });
      }
    });

    // 3) replace staffData and persist
    staffData = newData;
    localStorage.setItem('staffData', JSON.stringify(staffData));

    // 4) re-draw everything
    generateHeatmap();
    generateDailyGrids();

    //alert('Schedule updated.');
  });

  // 7) Initial render
  renderStaffTable();
  generateHeatmap();
  generateDailyGrids();
});