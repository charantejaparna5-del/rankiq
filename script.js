/* ===========================
   RankIQ — script.js
   AP EAMCET Rank Predictor
=========================== */
// Supabase Connection
const supabaseUrl = "https://ajnwiydxskyswasgbmvs.supabase.co/rest/v1/";

const supabaseKey = "sb_publishable_IIG-XRYbElB_-WQliOo3Hw_E0uAOKbQ";

const supabaseClient = supabase.createClient(
  supabaseUrl,
  supabaseKey
);

// ---- DATA ----

const EXAM_DATES = {
  engineering: [
    { value: "May 12", label: "May 12, 2026", difficulty: "medium" },
    { value: "May 13", label: "May 13, 2026", difficulty: "hard" },
    { value: "May 14", label: "May 14, 2026", difficulty: "medium" },
    { value: "May 15", label: "May 15, 2026", difficulty: "easy" },
    { value: "May 18", label: "May 18, 2026", difficulty: "hard" },
  ],
  agriculture: [
    { value: "May 19", label: "May 19, 2026", difficulty: "medium" },
    { value: "May 20", label: "May 20, 2026", difficulty: "easy" },
  ],
};

// Base rank thresholds [minMarks, topRank, topRankLabel]
const RANK_TABLE = [
  { min: 150, baseRank: 500,    label: "Top 1,000" },
  { min: 140, baseRank: 2000,   label: "Top 3,000" },
  { min: 130, baseRank: 4500,   label: "Top 6,000" },
  { min: 120, baseRank: 9000,   label: "Top 12,000" },
  { min: 110, baseRank: 17000,  label: "Top 22,000" },
  { min: 100, baseRank: 28500,  label: "Top 35,000" },
  { min: 90,  baseRank: 42500,  label: "Top 50,000" },
  { min: 80,  baseRank: 60000,  label: "Top 70,000" },
  { min: 70,  baseRank: 80000,  label: "Top 90,000" },
  { min: 60,  baseRank: 100000, label: "Top 1.1 Lakh" },
  { min: 0,   baseRank: 130000, label: "Above 1.1 Lakh" },
];

// Date difficulty normalization multiplier (lower = better rank)
const DATE_FACTOR = { hard: 0.93, medium: 1.0, easy: 1.06 };

// Shift normalization (Shift 2 harder → better rank)
const SHIFT_FACTOR = { "Shift 1": 1.0, "Shift 2": 0.94 };

// ---- STATE ----
let currentResult = null;

// ---- NAVBAR ----
window.addEventListener("scroll", () => {
  const nav = document.getElementById("navbar");
  nav.classList.toggle("scrolled", window.scrollY > 30);
});

document.getElementById("hamburger").addEventListener("click", function () {
  this.classList.toggle("open");
  document.getElementById("mobileMenu").classList.toggle("open");
});

function closeMenu() {
  document.getElementById("hamburger").classList.remove("open");
  document.getElementById("mobileMenu").classList.remove("open");
}

// ---- MARKS BAR ----
function updateMarksDisplay(input) {
  const val = parseInt(input.value);
  const bar = document.getElementById("marksBar");
  const display = document.getElementById("marksDisplay");
  if (!isNaN(val) && val >= 0 && val <= 160) {
    const pct = (val / 160) * 100;
    bar.style.width = pct + "%";
    display.textContent = val + " / 160";
  } else {
    bar.style.width = "0%";
    display.textContent = "—";
  }
}

// ---- DATE UPDATER ----
function updateDates() {
  const stream = document.getElementById("stream").value;
  const select = document.getElementById("examDate");
  select.innerHTML = "";

  if (!stream) {
    select.innerHTML = '<option value="">Select Stream First</option>';
    return;
  }

  const dates = EXAM_DATES[stream];
  select.innerHTML = '<option value="">Select Exam Date</option>';
  dates.forEach((d) => {
    const opt = document.createElement("option");
    opt.value = d.value;
    opt.textContent = d.label;
    select.appendChild(opt);
  });
}

// ---- SHIFT SELECTOR ----
function selectShift(shift) {
  document.getElementById("shift").value = shift;
  document.getElementById("shift1Btn").classList.toggle("active", shift === "Shift 1");
  document.getElementById("shift2Btn").classList.toggle("active", shift === "Shift 2");
}

// ---- RANK LOGIC ----
function getBaseRank(marks) {
  for (const entry of RANK_TABLE) {
    if (marks >= entry.min) return entry;
  }
  return RANK_TABLE[RANK_TABLE.length - 1];
}

function interpolateRank(marks) {
  // Find the bracket and interpolate smoothly
  for (let i = 0; i < RANK_TABLE.length - 1; i++) {
    const upper = RANK_TABLE[i];
    const lower = RANK_TABLE[i + 1];
    if (marks >= lower.min && marks < upper.min) {
      const range = upper.min - lower.min;
      const pos = marks - lower.min;
      const fraction = pos / range;
      const rankRange = lower.baseRank - upper.baseRank;
      return Math.round(lower.baseRank - fraction * rankRange);
    }
  }
  if (marks >= RANK_TABLE[0].min) return RANK_TABLE[0].baseRank;
  return RANK_TABLE[RANK_TABLE.length - 1].baseRank;
}

function getDateDifficulty(dateVal, stream) {
  const dates = EXAM_DATES[stream] || [];
  const found = dates.find((d) => d.value === dateVal);
  return found ? found.difficulty : "medium";
}

function predictRankValue(marks, category, stream, examDate, shift) {
  const baseRank = interpolateRank(marks);
  const dateDiff = getDateDifficulty(examDate, stream);
  const dateMult = DATE_FACTOR[dateDiff] || 1.0;
  const shiftMult = SHIFT_FACTOR[shift] || 1.0;

  const normalizedRank = Math.round(baseRank * dateMult * shiftMult);

  // Add a small random variance (±3%) for realism
  const variance = 0.97 + Math.random() * 0.06;
  const finalRank = Math.max(1, Math.round(normalizedRank * variance));

  // Rank range: ±8%
  const rangeMin = Math.max(1, Math.round(finalRank * 0.92));
  const rangeMax = Math.round(finalRank * 1.08);

  const bracketEntry = getBaseRank(marks);

  return {
    rank: finalRank,
    rangeMin,
    rangeMax,
    rangeLabel: bracketEntry.label,
    dateDifficulty: dateDiff,
    normDetails: buildNormDetails(shift, dateDiff, dateMult, shiftMult),
  };
}

function buildNormDetails(shift, dateDiff, dateMult, shiftMult) {
  const shiftNote =
    shift === "Shift 2"
      ? "Shift 2 normalization improved your rank (harder paper)"
      : "Shift 1 — no shift adjustment applied";

  const dateNote =
    dateDiff === "hard"
      ? "Date normalization improved your rank (harder exam day)"
      : dateDiff === "easy"
      ? "Date normalization slightly adjusted rank (easier exam day)"
      : "Moderate difficulty date — standard normalization applied";

  return `${shiftNote}. ${dateNote}.`;
}

function isQualified(marks, category) {
  if (category === "SC" || category === "ST") return true;
  return marks >= 40;
}

function formatRank(n) {
  if (n >= 100000) return (n / 100000).toFixed(1).replace(".0", "") + " Lakh";
  if (n >= 1000) return (n / 1000).toFixed(1).replace(".0", "") + "K";
  return n.toString();
}

function formatRankFull(n) {
  return n.toLocaleString("en-IN");
}

// ---- MAIN PREDICT FUNCTION ----
function predictRank() {
  const studentName = document.getElementById("studentName").value.trim();
const phoneNumber = document.getElementById("phoneNumber").value.trim();

if (!studentName) {
  showToast("Please enter student name.", "error");
  return;
}

if (!/^[6-9]\d{9}$/.test(phoneNumber)) {
  showToast("Please enter a valid mobile number.", "error");
  return;
}
   const marks = parseInt(document.getElementById("marks").value);
  const category = document.getElementById("category").value;
  const stream = document.getElementById("stream").value;
  const examDate = document.getElementById("examDate").value;
  const shift = document.getElementById("shift").value;

  // Validation
  const errors = [];
  if (isNaN(marks) || marks < 0 || marks > 160) errors.push("Please enter valid marks (0–160).");
  if (!category) errors.push("Please select your category.");
  if (!stream) errors.push("Please select your stream.");
  if (!examDate) errors.push("Please select your exam date.");

  if (errors.length > 0) {
    showToast(errors[0], "error");
    return;
  }

  // Show loading
  const btnText = document.querySelector(".btn-text");
  const btnLoader = document.getElementById("btnLoader");
  const btnArrow = document.querySelector(".btn-arrow");
  btnText.classList.add("hidden");
  btnArrow.classList.add("hidden");
  btnLoader.classList.remove("hidden");
  document.getElementById("predictBtn").disabled = true;

  setTimeout(() => {
    const result = predictRankValue(marks, category, stream, examDate, shift);
    const qualified = isQualified(marks, category);
    const percentile = ((marks / 160) * 100).toFixed(2);

    const streamLabel = stream === "engineering" ? "Engineering" : "Agriculture & Pharmacy";
    const dateLabel = EXAM_DATES[stream]?.find((d) => d.value === examDate)?.label || examDate;

    currentResult = { marks, category, stream: streamLabel, examDate: dateLabel, shift, result, qualified, percentile };

    displayResult(currentResult);

    // Reset button
    btnText.classList.remove("hidden");
    btnArrow.classList.remove("hidden");
    btnLoader.classList.add("hidden");
    document.getElementById("predictBtn").disabled = false;
  }, 1200);
}

// ---- DISPLAY RESULT ----
function displayResult({ marks, category, stream, examDate, shift, result, qualified, percentile }) {
  // Show section
  const section = document.getElementById("resultSection");
  section.style.display = "block";

  // Status badge
  const badge = document.getElementById("resultBadge");
  const badgeIcon = document.getElementById("resultBadgeIcon");
  const badgeText = document.getElementById("resultBadgeText");
  badge.className = "result-status-badge " + (qualified ? "qualified" : "not-qualified");
  badgeIcon.textContent = qualified ? "✅" : "❌";
  badgeText.textContent = qualified ? "Qualified" : "Not Qualified";

  // Meta
  document.getElementById("resultMeta").textContent = `${examDate} · ${shift} · ${stream}`;

  // Rank
  document.getElementById("displayRank").textContent = formatRankFull(result.rank);

  // Range
  document.getElementById("displayRange").textContent =
    `${formatRankFull(result.rangeMin)} – ${formatRankFull(result.rangeMax)}`;

  // Metrics
  document.getElementById("displayPercentile").textContent = percentile + "%";
  document.getElementById("displayMarks").textContent = marks + "/160";
  document.getElementById("displayCategory").textContent = category;
  document.getElementById("displayStream").textContent = stream === "Engineering" ? "Engg." : "Agri/Ph.";

  // Normalization note
  document.getElementById("normDetails").textContent = result.normDetails;

  // Scroll to result
  setTimeout(() => {
    section.scrollIntoView({ behavior: "smooth", block: "start" });
  }, 100);

  showToast("Rank predicted successfully!", "success");
}

// ---- RESET ----
function resetForm() {
  document.getElementById("marks").value = "";
  document.getElementById("category").value = "";
  document.getElementById("stream").value = "";
  document.getElementById("examDate").innerHTML = '<option value="">Select Stream First</option>';
  document.getElementById("shift").value = "Shift 1";
  selectShift("Shift 1");
  updateMarksDisplay({ value: "" });
  document.getElementById("resultSection").style.display = "none";
  currentResult = null;

  document.getElementById("predictor").scrollIntoView({ behavior: "smooth" });
}

// ---- PDF DOWNLOAD ----
async function downloadPDF() {
  if (!currentResult) return;

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const { marks, category, stream, examDate, shift, result, qualified, percentile } = currentResult;

  const W = 210;
  const margin = 20;
  let y = 0;

  // Background
  doc.setFillColor(5, 10, 20);
  doc.rect(0, 0, W, 297, "F");

  // Header gradient strip
  doc.setFillColor(0, 144, 255);
  doc.rect(0, 0, W, 40, "F");
  doc.setFillColor(123, 97, 255);
  doc.rect(W / 2, 0, W / 2, 40, "F");

  // Logo text
  doc.setFont("helvetica", "bold");
  doc.setFontSize(28);
  doc.setTextColor(255, 255, 255);
  doc.text("RankIQ", margin, 22);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(200, 230, 255);
  doc.text("AP EAMCET 2025 Rank Prediction Report", margin, 32);

  // Date on right
  doc.setTextColor(200, 230, 255);
  doc.text(`Generated: ${new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}`, W - margin, 22, { align: "right" });

  y = 55;

  // Qualification status pill
  const statusColor = qualified ? [0, 255, 140] : [255, 79, 79];
  doc.setFillColor(...statusColor);
  doc.roundedRect(margin, y, 60, 10, 5, 5, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(5, 10, 20);
  doc.text(qualified ? "✓ QUALIFIED" : "✗ NOT QUALIFIED", margin + 30, y + 6.5, { align: "center" });

  y += 22;

  // Rank display
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(140, 170, 200);
  doc.text("PREDICTED RANK", margin, y);
  y += 8;

  doc.setFontSize(42);
  doc.setTextColor(0, 212, 255);
  doc.text(formatRankFull(result.rank), margin, y);
  y += 6;

  doc.setFontSize(10);
  doc.setTextColor(100, 140, 170);
  doc.text(`Rank Range: ${formatRankFull(result.rangeMin)} – ${formatRankFull(result.rangeMax)}`, margin, y);
  y += 16;

  // Divider
  doc.setDrawColor(30, 50, 80);
  doc.setLineWidth(0.5);
  doc.line(margin, y, W - margin, y);
  y += 12;

  // Details table
  const rows = [
    ["Marks Obtained", `${marks} / 160`],
    ["Percentile", `${percentile}%`],
    ["Category", category],
    ["Stream", stream],
    ["Exam Date", examDate],
    ["Shift", shift],
    ["Exam Difficulty", result.dateDifficulty.charAt(0).toUpperCase() + result.dateDifficulty.slice(1)],
    ["Qualification", qualified ? "Qualified" : "Not Qualified (below cutoff)"],
  ];

  doc.setFontSize(10);
  rows.forEach(([label, value], i) => {
    const rowY = y + i * 13;
    if (i % 2 === 0) {
      doc.setFillColor(15, 25, 45);
      doc.roundedRect(margin, rowY - 5, W - margin * 2, 12, 2, 2, "F");
    }
    doc.setFont("helvetica", "normal");
    doc.setTextColor(120, 160, 190);
    doc.text(label, margin + 6, rowY + 2);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(220, 240, 255);
    doc.text(value, W - margin - 6, rowY + 2, { align: "right" });
  });

  y += rows.length * 13 + 10;

  // Normalization box
  doc.setFillColor(15, 20, 40);
  doc.setDrawColor(80, 60, 160);
  doc.setLineWidth(0.4);
  doc.roundedRect(margin, y, W - margin * 2, 28, 4, 4, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(150, 120, 255);
  doc.text("NORMALIZATION APPLIED", margin + 6, y + 9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(160, 180, 220);
  const normLines = doc.splitTextToSize(result.normDetails, W - margin * 2 - 12);
  doc.text(normLines, margin + 6, y + 17);

  y += 38;

  // Footer
  doc.setFillColor(10, 18, 35);
  doc.rect(0, 270, W, 27, "F");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(80, 100, 130);
  doc.text("This is an estimated prediction. Official ranks are published by the AP EAMCET board.", W / 2, 280, { align: "center" });
  doc.text("© 2025 RankIQ — Not affiliated with AP EAMCET official board.", W / 2, 287, { align: "center" });

  doc.save(`RankIQ_${category}_${marks}marks_${new Date().toISOString().slice(0, 10)}.pdf`);
  showToast("PDF downloaded successfully!", "success");
}

// ---- FAQ TOGGLE ----
function toggleFAQ(btn) {
  const item = btn.closest(".faq-item");
  const isOpen = item.classList.contains("open");

  // Close all
  document.querySelectorAll(".faq-item.open").forEach((el) => el.classList.remove("open"));

  if (!isOpen) item.classList.add("open");
}

// ---- TOAST ----
function showToast(message, type = "success") {
  const existing = document.querySelector(".toast");
  if (existing) existing.remove();

  const toast = document.createElement("div");
  toast.className = "toast";
  toast.style.cssText = `
    position: fixed; bottom: 28px; left: 50%; transform: translateX(-50%) translateY(20px);
    z-index: 9999; padding: 14px 28px; border-radius: 12px;
    font-family: 'DM Sans', sans-serif; font-size: 0.92rem; font-weight: 600;
    backdrop-filter: blur(20px);
    transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
    opacity: 0; white-space: nowrap;
    ${
      type === "success"
        ? "background: rgba(0,255,140,0.12); border: 1px solid rgba(0,255,140,0.3); color: #00ff8c;"
        : "background: rgba(255,79,79,0.12); border: 1px solid rgba(255,79,79,0.3); color: #ff6b6b;"
    }
    box-shadow: 0 8px 32px rgba(0,0,0,0.3);
  `;
  toast.textContent = (type === "success" ? "✓ " : "✗ ") + message;
  document.body.appendChild(toast);

  requestAnimationFrame(() => {
    toast.style.opacity = "1";
    toast.style.transform = "translateX(-50%) translateY(0)";
  });

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateX(-50%) translateY(10px)";
    setTimeout(() => toast.remove(), 400);
  }, 3200);
}

// ---- SCROLL ANIMATIONS ----
const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.style.opacity = "1";
        entry.target.style.transform = "translateY(0)";
      }
    });
  },
  { threshold: 0.12 }
);

document.querySelectorAll(".glass-card, .about-card, .faq-item, .section-header").forEach((el) => {
  el.style.opacity = "0";
  el.style.transform = "translateY(24px)";
  el.style.transition = "opacity 0.6s ease, transform 0.6s cubic-bezier(0.16, 1, 0.3, 1)";
  observer.observe(el);
});

// ---- INIT ----
window.addEventListener("DOMContentLoaded", () => {
  // Stagger card animations
  document.querySelectorAll(".about-card").forEach((card, i) => {
    card.style.transitionDelay = `${i * 0.08}s`;
  });
});
