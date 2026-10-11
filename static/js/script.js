let currentX = null;
const STORAGE_KEY = 'hits_868492'
let currentPoints = [];
let lastHistoryLength = 0;

const canvas = document.getElementById('graphCanvas');
const ctx = canvas.getContext('2d');
const rVisual = 130;
const cx = canvas.width / 2;
const cy = canvas.height / 2;

function drawGraph() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#3399FF';
    ctx.strokeStyle = '#000';

    // 1-я четверть: четверть круга
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, rVisual, 0, -0.5 * Math.PI, true);
    ctx.closePath();
    ctx.fill();

    // 2-я четверть: прямоугольник
    ctx.fillRect(cx - rVisual/2, cy - rVisual, rVisual/2, rVisual);

    // 3-я четверть: треугольник
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx - rVisual/2, cy);
    ctx.lineTo(cx, cy + rVisual/2);
    ctx.closePath();
    ctx.fill();

    // Оси
    ctx.beginPath();
    ctx.moveTo(0, cy);
    ctx.lineTo(canvas.width, cy);
    ctx.moveTo(cx, 0);
    ctx.lineTo(cx, canvas.height);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(canvas.width - 10, cy - 5);
    ctx.lineTo(canvas.width, cy);
    ctx.lineTo(canvas.width - 10, cy + 5);
    ctx.moveTo(cx - 5, 10);
    ctx.lineTo(cx, 0);
    ctx.lineTo(cx + 5, 10);
    ctx.stroke();

    ctx.fillStyle = '#000';
    ctx.font = '14px sans-serif';
    ctx.fillText('x', canvas.width - 15, cy - 15);
    ctx.fillText('y', cx + 15, 15);

    ctx.fillText('R', cx + rVisual, cy + 15);
    ctx.fillText('R/2', cx + rVisual/2, cy + 15);
    ctx.fillText('-R/2', cx - rVisual/2, cy + 15);
    ctx.fillText('-R', cx - rVisual, cy + 15);

    ctx.fillText('R', cx + 10, cy - rVisual);
    ctx.fillText('R/2', cx + 10, cy - rVisual/2);
    ctx.fillText('-R/2', cx + 10, cy + rVisual/2);
    ctx.fillText('-R', cx + 10, cy + rVisual);
}

function drawPoint(x, y, r, isHit) {
    const xPx = cx + (x / r) * rVisual;
    const yPx = cy - (y / r) * rVisual;

    ctx.beginPath();
    ctx.arc(xPx, yPx, 4, 0, 2 * Math.PI);

    ctx.fillStyle = isHit ? '#28a745' : '#dc3545';
    ctx.fill();

    ctx.strokeStyle = '#000';
    ctx.stroke();
    ctx.closePath();
}

window.setX = function(val, btnElement) {
    currentX = val;
    document.getElementById('x-error').style.display = 'none';

    const btns = document.querySelectorAll('.x-btn');
    btns.forEach(btn => btn.classList.remove('active'));
    btnElement.classList.add('active');
};

function updateTable(historyData) {
    const tbody = document.getElementById("results-body");
    if (!tbody) return;
    tbody.innerHTML = "";

    historyData.forEach(row => {
        const dateObj = new Date(row.time.replace(" ", "T") + "+03:00");
        const formattedTime = new Intl.DateTimeFormat('ru-RU', {
            year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit', second: '2-digit'
        }).format(dateObj);

        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>${row.x}</td>
            <td>${row.y}</td>
            <td>${row.r}</td>
            <td style="color: ${row.hit ? 'green' : 'red'}">${row.hit ? "Попадание" : "Промах"}</td>
            <td>${formattedTime}</td>
            <td>${row.exec_time}</td>
        `;
        tbody.appendChild(tr);
    });
}

document.getElementById('pointForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    document.querySelectorAll('.error').forEach(el => el.style.display = 'none');
    let isValid = true;

    if (currentX === null) {
        document.getElementById('x-error').style.display = 'block';
        isValid = false;
    }

    let rawY = document.getElementById('y-val').value.trim().replace(',', '.');
    let yVal = Number(rawY);
    if (isNaN(yVal) || rawY === "" || yVal <= -3 || yVal >= 3) {
        document.getElementById('y-error').style.display = 'block';
        isValid = false;
    }

    const checkedR = document.querySelectorAll('input[name="r-val"]:checked');
    if (checkedR.length < 1) {
        document.getElementById('r-error').style.display = 'block';
        isValid = false;
    }

    if (!isValid) return;

    let arrayR = [];
    for (const cb of checkedR) {
        arrayR.push(parseFloat(cb.value));
    }

    const url = `/fcgi-bin/server.jar?x=${encodeURIComponent(currentX)}&y=${encodeURIComponent(yVal)}&array=${encodeURIComponent(JSON.stringify(arrayR))}`;

    try {
        const response = await fetch(url, { method: 'GET', cache: 'no-store' });
        if (!response.ok) throw new Error(`Ошибка HTTP: ${response.status}`);

        const historyArray = await response.json();
        lastHistoryLength = historyArray.length;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        drawGraph();

        currentPoints = [];
        historyArray.forEach(pt => {
            currentPoints.push({ x: pt.x, y: pt.y, r: pt.r, hit: pt.hit });
            drawPoint(pt.x, pt.y, pt.r, pt.hit);
        });

        updateTable(historyArray);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(historyArray));

    } catch (error) {
        console.error('Ошибка при обращении к серверу:', error);
    }
});

document.getElementById('clearBtn').addEventListener('click', async () => {
    try {
        await fetch('/fcgi-bin/server.jar?clear=1', { method: 'GET', cache: 'no-store' });
    } catch (e) {
        console.error('Ошибка при очистке сервера:', e);
    }

    lastHistoryLength = 0;
    localStorage.removeItem(STORAGE_KEY);
    currentPoints = [];
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawGraph();
    updateTable([]);
});

async function checkServerStatus() {
    const statusSpan = document.getElementById('serverStatus');
    try {
        const response = await fetch('/fcgi-bin/server.jar?ping=1', { method: 'GET', signal: AbortSignal.timeout(3000) });
        if (response.ok) {
            statusSpan.textContent = "Онлайн 🟢";
            statusSpan.style.color = "green";
        } else {
            throw new Error();
        }
    } catch (e) {
        statusSpan.textContent = "Оффлайн 🔴";
        statusSpan.style.color = "red";
    }
}

function setOfflineStatus() {
    const statusSpan = document.getElementById('serverStatus');
    if (statusSpan) {
        statusSpan.textContent = "Оффлайн 🔴";
        statusSpan.style.color = "red";
    }
}

checkServerStatus();
setInterval(checkServerStatus, 5000);

// Функция фонового обновления
async function pollServerForUpdates() {
    try {
        const response = await fetch('/fcgi-bin/server.jar?action=update', {
            method: 'GET',
            cache: 'no-store'
        });
        if (!response.ok) return;

        const serverHistory = await response.json();

        if (serverHistory.length !== lastHistoryLength) {
            lastHistoryLength = serverHistory.length;

            updateTable(serverHistory);
            currentPoints = [];
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            drawGraph();

            serverHistory.forEach(pt => {
                currentPoints.push({ x: pt.x, y: pt.y, r: pt.r, hit: pt.hit });
                drawPoint(pt.x, pt.y, pt.r, pt.hit);
            });

            if (serverHistory.length === 0) {
                localStorage.removeItem(STORAGE_KEY);
            } else {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(serverHistory));
            }
        }
    } catch (error) {}
}

window.addEventListener('load', () => {
    drawGraph();

    let results = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    if (Array.isArray(results) && results.length > 0) {
        lastHistoryLength = results.length;
        updateTable(results);
        results.forEach(pt => {
            currentPoints.push({ x: pt.x, y: pt.y, r: pt.r, hit: pt.hit });
            drawPoint(pt.x, pt.y, pt.r, pt.hit);
        });
    }

    setInterval(pollServerForUpdates, 2000);
});
