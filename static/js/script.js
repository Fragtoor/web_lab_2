let currentX = null;
const STORAGE_KEY = 'hits_22610';
const canvas = document.getElementById('graphCanvas');
const ctx = canvas.getContext('2d');
const rVisual = 150;
const cx = canvas.width / 2;
const cy = canvas.height / 2;

function drawGraph() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#3399FF';
    ctx.strokeStyle = '#000';

    // Треугольник
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + rVisual, cy);
    ctx.lineTo(cx, cy - rVisual/2);
    ctx.closePath();
    ctx.fill();

    // Квадрат
    ctx.fillRect(cx - rVisual, cy - rVisual, rVisual, rVisual);

    // Четверть круга
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, rVisual/2, 0.5 * Math.PI, Math.PI, false);
    ctx.closePath();
    ctx.fill();

    // Оси
    ctx.beginPath();
    ctx.moveTo(0, cy);
    ctx.lineTo(canvas.width, cy);
    ctx.moveTo(cx, 0);
    ctx.lineTo(cx, canvas.height);
    ctx.stroke();

    // Стрелки
    ctx.beginPath();
    ctx.moveTo(canvas.width - 10, cy - 5);
    ctx.lineTo(canvas.width, cy);
    ctx.lineTo(canvas.width - 10, cy + 5);
    ctx.moveTo(cx - 5, 10);
    ctx.lineTo(cx, 0);
    ctx.lineTo(cx + 5, 10);
    ctx.stroke();

    // Подписи осей
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

// Отрисовка точки
function drawPoint(x, y, r) {
    const canvasX = cx + (x / r) * rVisual;
    const canvasY = cy - (y / r) * rVisual;

    ctx.beginPath();
    ctx.arc(canvasX, canvasY, 4, 0, 2 * Math.PI);
    ctx.fillStyle = 'red';
    ctx.fill();
    ctx.closePath();
}

// Обработчик кнопок X
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

function loadResults() {
    let results = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    if (Array.isArray(results)) {
        updateTable(results);
        drawGraph();
        // Сразу рисуем все точки из истории
        results.forEach(res => drawPoint(res.x, res.y, res.r));
    }
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
    } else if (rawY.includes('.')) {
        let decPart = rawY.split('.')[1];
        if ((yVal === 3 || yVal === -3) && /[1-9]/.test(decPart)) {
            document.getElementById('y-error').style.display = 'block';
            isValid = false;
        }
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

    const url = `/fcgi-bin/server.jar?x=${currentX}&y=${yVal}&array=${encodeURIComponent(JSON.stringify(arrayR))}`;

    try {
        const response = await fetch(url, { method: 'GET' });
        if (!response.ok) throw new Error(`Ошибка HTTP: ${response.status}`);

        const historyArray = await response.json();

        drawGraph();
        historyArray.forEach(res => {
            drawPoint(res.x, res.y, res.r);
        });

        updateTable(historyArray);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(historyArray));

    } catch (error) {
        console.error('Ошибка при обращении к FastCGI-серверу:', error);
        setOfflineStatus();
    }
});

document.getElementById('clearBtn').addEventListener('click', async () => {
      try {
          await fetch('/fcgi-bin/server.jar?clear=1', { method: 'GET' });
      } catch (e) {
          console.error('Ошибка при очистке сервера:', e);
          setOfflineStatus();
      }

      localStorage.removeItem(STORAGE_KEY);
      updateTable([]);
      drawGraph();
});

// Инициализация при загрузке страницы
drawGraph();
loadResults();

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
