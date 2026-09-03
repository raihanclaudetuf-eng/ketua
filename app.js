document.addEventListener("DOMContentLoaded", () => {
  if (window.lucide) {
    window.lucide.createIcons();
  }
  const yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  // 1. Tab Navigation
  const dashBtn = document.getElementById("tab-btn-dashboard");
  const haditsBtn = document.getElementById("tab-btn-hadits");
  const dashView = document.getElementById("view-dashboard");
  const haditsView = document.getElementById("view-hadits");

  function switchTab(tabId) {
    if (tabId === "dashboard") {
      dashView.classList.remove("hidden");
      haditsView.classList.add("hidden");
      dashBtn.classList.add("active");
      dashBtn.classList.remove("text-sand/60");
      haditsBtn.classList.remove("active");
      haditsBtn.classList.add("text-sand/60");
    } else {
      dashView.classList.add("hidden");
      haditsView.classList.remove("hidden");
      haditsBtn.classList.add("active");
      haditsBtn.classList.remove("text-sand/60");
      dashBtn.classList.remove("active");
      dashBtn.classList.add("text-sand/60");
    }
    if (window.lucide) window.lucide.createIcons();
  }

  if (dashBtn) dashBtn.addEventListener("click", () => switchTab("dashboard"));
  if (haditsBtn) haditsBtn.addEventListener("click", () => switchTab("hadits"));

  // 2. State & Data Simulasi
  const MAX_POINTS = 20;
  const state = {
    simulating: false,
    simTimer: null,
    scenario: "normal",
    labels: [],
    turb: [],
    mq135: [],
    mq3: [],
    hasAlertedForCurrentAnomaly: false, // Mencegah spam pop-up terus menerus
  };

  const SCENARIOS = {
    normal: {
      turbBase: 2.5,
      turbJit: 1.2,
      mq135Base: 1.05,
      mq135Jit: 0.15,
      mq3Base: 0.9,
      mq3Jit: 0.15,
    },
    tanah: {
      turbBase: 38,
      turbJit: 8,
      mq135Base: 1.15,
      mq135Jit: 0.2,
      mq3Base: 0.95,
      mq3Jit: 0.15,
    },
    amonia: {
      turbBase: 3.5,
      turbJit: 1.5,
      mq135Base: 4.6,
      mq135Jit: 0.6,
      mq3Base: 1.1,
      mq3Jit: 0.2,
    },
    fermentasi: {
      turbBase: 6,
      turbJit: 2,
      mq135Base: 2.1,
      mq135Jit: 0.3,
      mq3Base: 5.4,
      mq3Jit: 0.7,
    },
  };

  function randIn(base, jitter) {
    return Math.max(0, base + (Math.random() - 0.5) * 2 * jitter);
  }

  // 3. Audio Beep Peringatan (Menggunakan Web Audio API, tanpa file mp3)
  function playAlertSound() {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(880, audioCtx.currentTime); // Nada A5
      gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.4);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.4);
    } catch (e) {
      // Browser memblokir autoplay audio bila belum ada interaksi pengguna
    }
  }

  // 4. Pengendali Pop-up Notifikasi Otomatis
  const alertModal = document.getElementById("alert-modal");
  const modalCloseBtn = document.getElementById("modal-close-btn");
  const modalViolationDetail = document.getElementById(
    "modal-violation-detail",
  );

  function triggerAutomaticNotification(violationText) {
    if (alertModal.classList.contains("hidden")) {
      modalViolationDetail.innerHTML = violationText;
      alertModal.classList.remove("hidden");
      playAlertSound();
      if (window.lucide) window.lucide.createIcons();
    }
  }

  if (modalCloseBtn) {
    modalCloseBtn.addEventListener("click", () => {
      alertModal.classList.add("hidden");
    });
  }

  // 5. Klasifikasi Penyimpangan & Logika Kelayakan Wudhu
  function classify(turb, mq135, mq3) {
    const turbDev = turb > 30 ? 2 : turb > 8 ? 1 : 0;
    const mq135Dev = mq135 > 4 ? 2 : mq135 > 2 ? 1 : 0;
    const mq3Dev = mq3 > 4 ? 2 : mq3 > 2 ? 1 : 0;

    const maxDev = Math.max(turbDev, mq135Dev, mq3Dev);
    const deviantCount = [turbDev, mq135Dev, mq3Dev].filter(
      (d) => d > 0,
    ).length;

    let deviationPercent = 5;
    if (maxDev === 1) deviationPercent = 35 + Math.round(Math.random() * 15);
    if (maxDev === 2) deviationPercent = 75 + Math.round(Math.random() * 20);

    let deviationLabel = "Rendah (" + deviationPercent + "%)";
    if (maxDev === 1) deviationLabel = "Sedang (" + deviationPercent + "%)";
    if (maxDev === 2) deviationLabel = "Tinggi (" + deviationPercent + "%)";

    let wudhuScore = 100 - deviationPercent;

    let status = "normal";
    if (maxDev === 2) status = "anomali";
    else if (maxDev === 1) status = "perubahan";

    let wudhuVerdict = {
      status: "LAYAK",
      title: "Air Suci & Menyucikan (Mutlak)",
      desc: "Kejernihan dan uap gas normal. Sah digunakan untuk berwudhu.",
      colorClass: "text-ocean-glow",
      badgeClass: "bg-ocean-core/20 text-ocean-glow border-ocean-glow/30",
      barClass: "bg-ocean-glow",
    };

    if (wudhuScore < 50 || maxDev === 2) {
      wudhuVerdict = {
        status: "TIDAK LAYAK",
        title: "Tidak Sah / Berpotensi Mutanajis",
        desc: "Terdeteksi bau menyengat atau kontaminasi berat. Tidak boleh untuk wudhu.",
        colorClass: "text-red-400",
        badgeClass: "bg-red-500/20 text-red-400 border-red-500/30",
        barClass: "bg-red-500",
      };

      // Kumpulkan rincian pelanggaran untuk pop-up
      let violations = [];
      if (turbDev === 2)
        violations.push(
          "• <strong>Sifat Warna (Al-Laun):</strong> Air sangat keruh (" +
            turb.toFixed(1) +
            " NTU).",
        );
      if (mq135Dev === 2)
        violations.push(
          "• <strong>Sifat Bau (Ar-Rih):</strong> Terdeteksi gas amonia/limbah pekat (" +
            mq135.toFixed(2) +
            " Rs/Ro).",
        );
      if (mq3Dev === 2)
        violations.push(
          "• <strong>Sifat Bau (Ar-Rih):</strong> Uap fermentasi/busuk tinggi (" +
            mq3.toFixed(2) +
            " Rs/Ro).",
        );

      // Tampilkan notifikasi otomatis jika belum pernah ditampilkan pada skenario ini
      if (!state.hasAlertedForCurrentAnomaly) {
        triggerAutomaticNotification(violations.join("<br>"));
        state.hasAlertedForCurrentAnomaly = true;
      }
    } else {
      // Reset status notifikasi saat air kembali normal/syubhat
      state.hasAlertedForCurrentAnomaly = false;

      if (wudhuScore < 80 || maxDev === 1) {
        wudhuVerdict = {
          status: "SYUBHAT / PERIKSA",
          title: "Perubahan Terdeteksi (Perlu Verifikasi)",
          desc: "Ada perubahan ringan pada air. Disarankan dicek fisik sebelum berwudhu.",
          colorClass: "text-amber-400",
          badgeClass: "bg-amber-500/20 text-amber-400 border-amber-500/30",
          barClass: "bg-amber-400",
        };
      }
    }

    return {
      status,
      deviationLabel,
      deviantCount,
      turbDev,
      mq135Dev,
      mq3Dev,
      wudhuScore,
      wudhuVerdict,
    };
  }

  function fetchLiveReading() {
    const s = SCENARIOS[state.scenario];
    return {
      turbidity_ntu: randIn(s.turbBase, s.turbJit),
      turbidity_v: (1.2 + randIn(s.turbBase, s.turbJit) * 0.02).toFixed(2),
      mq135_rsro: randIn(s.mq135Base, s.mq135Jit),
      mq3_rsro: randIn(s.mq3Base, s.mq3Jit),
      timestamp: new Date(),
    };
  }

  // 6. Konfigurasi Chart.js
  const canvasEl = document.getElementById("trend-chart");
  let trendChart = null;
  if (canvasEl) {
    const ctx = canvasEl.getContext("2d");
    trendChart = new Chart(ctx, {
      type: "line",
      data: {
        labels: [],
        datasets: [
          {
            label: "Turbidity (NTU)",
            data: [],
            borderColor: "#06B6D4",
            backgroundColor: "rgba(6,182,212,0.12)",
            yAxisID: "y",
            tension: 0.35,
            pointRadius: 0,
            borderWidth: 2,
            fill: true,
          },
          {
            label: "MQ-135 (Rs/Ro)",
            data: [],
            borderColor: "#F59E0B",
            backgroundColor: "transparent",
            yAxisID: "y1",
            tension: 0.35,
            pointRadius: 0,
            borderWidth: 2,
          },
          {
            label: "MQ-3 (Rs/Ro)",
            data: [],
            borderColor: "#F87171",
            backgroundColor: "transparent",
            yAxisID: "y1",
            tension: 0.35,
            pointRadius: 0,
            borderWidth: 2,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        plugins: {
          legend: {
            labels: {
              color: "#F1F5F9",
              boxWidth: 12,
              font: { family: "Inter", size: 11 },
            },
          },
          tooltip: {
            backgroundColor: "#0B1522",
            borderColor: "rgba(6,182,212,0.3)",
            borderWidth: 1,
            titleColor: "#F1F5F9",
            bodyColor: "#F1F5F9",
          },
        },
        scales: {
          x: {
            ticks: {
              color: "rgba(241,245,249,0.4)",
              font: { family: "Space Mono", size: 10 },
            },
            grid: { color: "rgba(241,245,249,0.05)" },
          },
          y: {
            position: "left",
            title: {
              display: true,
              text: "NTU",
              color: "rgba(241,245,249,0.4)",
              font: { size: 10 },
            },
            ticks: { color: "rgba(241,245,249,0.4)", font: { size: 10 } },
            grid: { color: "rgba(241,245,249,0.05)" },
          },
          y1: {
            position: "right",
            title: {
              display: true,
              text: "Rs/Ro",
              color: "rgba(241,245,249,0.4)",
              font: { size: 10 },
            },
            ticks: { color: "rgba(241,245,249,0.4)", font: { size: 10 } },
            grid: { display: false },
          },
        },
      },
    });
  }

  function badgeClasses(level) {
    if (level === 0) return "bg-ocean-core/20 text-ocean-glow";
    if (level === 1) return "bg-amber-500/20 text-amber-400";
    return "bg-red-500/20 text-red-400";
  }
  function badgeText(level) {
    return level === 0 ? "Normal" : level === 1 ? "Perubahan" : "Anomali";
  }
  function barColor(level) {
    return level === 0
      ? "bg-ocean-glow"
      : level === 1
        ? "bg-amber-400"
        : "bg-red-400";
  }

  // 7. Update UI
  function updateUI(reading) {
    const { turbidity_ntu, turbidity_v, mq135_rsro, mq3_rsro, timestamp } =
      reading;
    const {
      status,
      deviationLabel,
      deviantCount,
      turbDev,
      mq135Dev,
      mq3Dev,
      wudhuScore,
      wudhuVerdict,
    } = classify(turbidity_ntu, mq135_rsro, mq3_rsro);

    const lastReadingEl = document.getElementById("last-reading");
    if (lastReadingEl)
      lastReadingEl.textContent = timestamp.toLocaleTimeString("id-ID");

    // Update Index Wudhu
    const wudhuScoreEl = document.getElementById("wudhu-score");
    if (wudhuScoreEl) wudhuScoreEl.textContent = wudhuScore;
    const statusBadge = document.getElementById("wudhu-status-badge");
    if (statusBadge) {
      statusBadge.textContent = wudhuVerdict.status;
      statusBadge.className =
        "px-2.5 py-1 text-xs font-bold rounded-full border " +
        wudhuVerdict.badgeClass;
    }
    const verdictTitle = document.getElementById("wudhu-verdict-title");
    if (verdictTitle) {
      verdictTitle.textContent = wudhuVerdict.title;
      verdictTitle.className =
        "text-sm font-semibold mt-1 " + wudhuVerdict.colorClass;
    }
    const verdictDesc = document.getElementById("wudhu-verdict-desc");
    if (verdictDesc) verdictDesc.textContent = wudhuVerdict.desc;
    const progressBar = document.getElementById("wudhu-progress");
    if (progressBar) {
      progressBar.style.width = wudhuScore + "%";
      progressBar.className =
        "h-full rounded-full transition-all duration-700 " +
        wudhuVerdict.barClass;
    }

    // Turbidity Card
    document.getElementById("turb-value").textContent =
      turbidity_ntu.toFixed(1);
    document.getElementById("turb-volt").textContent = turbidity_v;
    const turbBadge = document.getElementById("turb-badge");
    turbBadge.className =
      "text-[11px] font-semibold px-2.5 py-1 rounded-full " +
      badgeClasses(turbDev);
    turbBadge.textContent = badgeText(turbDev);
    const turbBar = document.getElementById("turb-bar");
    turbBar.style.width = Math.min(100, (turbidity_ntu / 60) * 100) + "%";
    turbBar.className =
      "h-full rounded-full transition-all duration-700 " + barColor(turbDev);

    // MQ-135 Card
    document.getElementById("mq135-value").textContent = mq135_rsro.toFixed(2);
    document.getElementById("mq135-level").textContent =
      mq135Dev === 0 ? "rendah" : mq135Dev === 1 ? "sedang" : "tinggi";
    const mq135Badge = document.getElementById("mq135-badge");
    mq135Badge.className =
      "text-[11px] font-semibold px-2.5 py-1 rounded-full " +
      badgeClasses(mq135Dev);
    mq135Badge.textContent = badgeText(mq135Dev);
    const mq135Bar = document.getElementById("mq135-bar");
    mq135Bar.style.width = Math.min(100, (mq135_rsro / 6) * 100) + "%";
    mq135Bar.className =
      "h-full rounded-full transition-all duration-700 " + barColor(mq135Dev);

    // MQ-3 Card
    document.getElementById("mq3-value").textContent = mq3_rsro.toFixed(2);
    document.getElementById("mq3-level").textContent =
      mq3Dev === 0 ? "rendah" : mq3Dev === 1 ? "sedang" : "tinggi";
    const mq3Badge = document.getElementById("mq3-badge");
    mq3Badge.className =
      "text-[11px] font-semibold px-2.5 py-1 rounded-full " +
      badgeClasses(mq3Dev);
    mq3Badge.textContent = badgeText(mq3Dev);
    const mq3Bar = document.getElementById("mq3-bar");
    mq3Bar.style.width = Math.min(100, (mq3_rsro / 6) * 100) + "%";
    mq3Bar.className =
      "h-full rounded-full transition-all duration-700 " + barColor(mq3Dev);

    // Hero Section
    const heroIconRing = document.getElementById("hero-icon-ring");
    const heroIcon = document.getElementById("hero-icon");
    const heroTitle = document.getElementById("hero-title");
    const heroDesc = document.getElementById("hero-desc");
    const heroGlow = document.getElementById("hero-glow");
    const connDot = document.getElementById("conn-dot");

    heroIconRing.classList.remove("status-pulse", "amber", "red");
    void heroIconRing.offsetWidth;
    heroIconRing.classList.add("status-pulse");

    if (status === "normal") {
      heroTitle.textContent = "NORMAL — Karakteristik Mutlak Terjaga";
      heroTitle.className =
        "font-display font-700 text-lg sm:text-xl text-ocean-glow leading-tight";
      heroDesc.textContent =
        "Kekeruhan dan uap gas berada dalam batas baseline air bersih wudhu.";
      heroIcon.setAttribute("data-lucide", "shield-check");
      heroIconRing.className =
        "status-pulse w-14 h-14 rounded-2xl bg-ocean-core/20 grain-border flex items-center justify-center shrink-0";
      heroIcon.className = "w-7 h-7 text-ocean-glow";
      heroGlow.style.background = "#06B6D4";
      connDot.className = "w-2.5 h-2.5 rounded-full bg-ocean-glow status-pulse";
    } else if (status === "perubahan") {
      heroTitle.textContent = "PERUBAHAN TERDETEKSI";
      heroTitle.className =
        "font-display font-700 text-lg sm:text-xl text-amber-400 leading-tight";
      heroDesc.textContent =
        "Terjadi deviasi ringan pada salah satu sifat fisik/gas dibanding batas acuan.";
      heroIcon.setAttribute("data-lucide", "alert-triangle");
      heroIconRing.className =
        "status-pulse amber w-14 h-14 rounded-2xl bg-amber-500/20 grain-border flex items-center justify-center shrink-0";
      heroIcon.className = "w-7 h-7 text-amber-400";
      heroGlow.style.background = "#F59E0B";
      connDot.className =
        "w-2.5 h-2.5 rounded-full bg-amber-400 status-pulse amber";
    } else {
      heroTitle.textContent = "PERLU PEMERIKSAAN — Anomali Signifikan";
      heroTitle.className =
        "font-display font-700 text-lg sm:text-xl text-red-400 leading-tight";
      heroDesc.textContent =
        "Kekeruhan tinggi atau senyawa gas anomali pekat terdeteksi di luar ambang batas.";
      heroIcon.setAttribute("data-lucide", "alert-octagon");
      heroIconRing.className =
        "status-pulse red w-14 h-14 rounded-2xl bg-red-500/20 grain-border flex items-center justify-center shrink-0";
      heroIcon.className = "w-7 h-7 text-red-400";
      heroGlow.style.background = "#EF4444";
      connDot.className =
        "w-2.5 h-2.5 rounded-full bg-red-400 status-pulse red";
    }
    if (window.lucide) window.lucide.createIcons();

    const devEl = document.getElementById("hero-deviation");
    if (devEl) devEl.textContent = deviationLabel;

    document.getElementById("hero-deviant").textContent = deviantCount + " / 3";

    // Update Chart
    if (trendChart) {
      const label = timestamp.toLocaleTimeString("id-ID", {
        minute: "2-digit",
        second: "2-digit",
      });
      state.labels.push(label);
      state.turb.push(Number(turbidity_ntu.toFixed(2)));
      state.mq135.push(Number(mq135_rsro.toFixed(2)));
      state.mq3.push(Number(mq3_rsro.toFixed(2)));
      if (state.labels.length > MAX_POINTS) {
        state.labels.shift();
        state.turb.shift();
        state.mq135.shift();
        state.mq3.shift();
      }
      trendChart.data.labels = state.labels;
      trendChart.data.datasets[0].data = state.turb;
      trendChart.data.datasets[1].data = state.mq135;
      trendChart.data.datasets[2].data = state.mq3;
      trendChart.update("none");
    }
  }

  function tick() {
    const reading = fetchLiveReading();
    updateUI(reading);
  }

  // 8. Kontrol Simulasi & Tombol Skenario
  const simToggle = document.getElementById("sim-toggle");
  const simIcon = document.getElementById("sim-icon");
  const simLabel = document.getElementById("sim-label");

  if (simToggle) {
    simToggle.addEventListener("click", () => {
      state.simulating = !state.simulating;
      if (state.simulating) {
        simIcon.setAttribute("data-lucide", "pause");
        simLabel.textContent = "Jeda Simulasi";
        state.simTimer = setInterval(tick, 1200);
        tick();
      } else {
        simIcon.setAttribute("data-lucide", "play");
        simLabel.textContent = "Mulai Simulasi";
        clearInterval(state.simTimer);
      }
      if (window.lucide) window.lucide.createIcons();
    });
  }

  document.querySelectorAll(".scenario-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document
        .querySelectorAll(".scenario-btn")
        .forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      state.scenario = btn.dataset.scenario;
      state.hasAlertedForCurrentAnomaly = false; // Reset flag agar skenario baru bisa memicu alert
      tick();
      if (!state.simulating && simToggle) {
        simToggle.click();
      }
    });
  });

  tick();
});
