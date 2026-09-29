let currentR = null;
const STORAGE_KEY = 'hits_22610';
let currentPoints = [];
const canvas = document.getElementById('graphCanvas');
const ctx = canvas.getContext('2d');
const rVisual = 150;
const cx = canvas.width / 2;
const cy = canvas.height / 2;

function drawGraph(rLabel) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#3399FF';
    ctx.strokeStyle = '#000';

    if (currentR !== null) {
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + rVisual, cy);
        ctx.lineTo(cx, cy - rVisual/2);
        ctx.closePath();
        ctx.fill();

        ctx.fillRect(cx - rVisual, cy - rVisual, rVisual, rVisual);

        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, rVisual/2, 0.5 * Math.PI, Math.PI, false);
        ctx.closePath();
        ctx.fill();
    }

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

    const R = rLabel || 'R';
    const R2 = rLabel ? (rLabel / 2) : 'R/2';
    const mR = rLabel ? (-rLabel) : '-R';
    const mR2 = rLabel ? (-rLabel / 2) : '-R/2';

    ctx.fillText(R, cx + rVisual, cy + 15);
    ctx.fillText(R2, cx + rVisual/2, cy + 15);
    ctx.fillText(mR2, cx - rVisual/2, cy + 15);
    ctx.fillText(mR, cx - rVisual, cy + 15);

    ctx.fillText(R, cx + 10, cy - rVisual);
    ctx.fillText(R2, cx + 10, cy - rVisual/2);
    ctx.fillText(mR2, cx + 10, cy + rVisual/2);
    ctx.fillText(mR, cx + 10, cy + rVisual);
}

function drawPoint(x, y, r) {
    const canvasX = cx + (x / r) * rVisual;
    const canvasY = cy - (y / r) * rVisual;

    ctx.beginPath();
    ctx.arc(canvasX, canvasY, 4, 0, 2 * Math.PI);
    ctx.fillStyle = 'red';
    ctx.fill();
    ctx.closePath();
}

window.setR = function(val, btnElement) {
    currentR = val;
    document.getElementById('r-error').style.display = 'none';

    const btns = document.querySelectorAll('.r-btn');
    btns.forEach(btn => btn.classList.remove('active'));
    btnElement.classList.add('active');

    drawGraph(currentR);
    // Отрисовываем все точки из истории для нового радиуса
    currentPoints.forEach(pt => drawPoint(pt.x, pt.y, currentR));
};

function checkHit(x, y, r) {
    if (x >= 0 && y >= 0) return (x + 2*y) <= r;
    if (x <= 0 && y >= 0) return x >= -r && y <= r;
    if (x <= 0 && y <= 0) return (x*x + y*y) <= (r/2)*(r/2);
    return false;
}

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
        // Восстанавливаем точки в память, чтобы они отрисовались при первом клике на радиус
        currentPoints = results.map(res => ({ x: res.x, y: res.y }));
    }
}

document.getElementById('pointForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    document.querySelectorAll('.error').forEach(el => el.style.display = 'none');
    let isValid = true;

    const checkedX = document.querySelectorAll('input[name="x-val"]:checked');
    if (checkedX.length < 1) {
        document.getElementById('x-error').style.display = 'block';
        isValid = false;
    }

    // Валидация Y
    let rawY = document.getElementById('y-val').value.trim().replace(',', '.');
    let yVal = Number(rawY);

    if (isNaN(yVal) || rawY === "" || yVal <= -5 || yVal >= 3) {
        document.getElementById('y-error').style.display = 'block';
        isValid = false;
    } else if (rawY.includes('.')) {
        let decPart = rawY.split('.')[1];
        if ((yVal === 3 || yVal === -5) && /[1-9]/.test(decPart)) {
            document.getElementById('y-error').style.display = 'block';
            isValid = false;
        }
    }

    if (currentR === null) {
        document.getElementById('r-error').style.display = 'block';
        isValid = false;
    }

    if (!isValid) return;

    currentPoints = [];
    drawGraph(currentR);

    // Отправляем запросы на FastCGI-сервер для каждого выбранного X
    for (const cb of checkedX) {
        const xVal = parseFloat(cb.value);
        const url = `/fcgi-bin/server.jar?x=${encodeURIComponent(xVal)}&y=${encodeURIComponent(yVal)}&r=${encodeURIComponent(currentR)}`;

        try {
            const response = await fetch(url, { method: 'GET' });
            if (!response.ok) throw new Error(`Ошибка HTTP: ${response.status}`);

            // Сервер возвращает массив: [{ x, y, r, hit, time, exec_time }, ...]
            const historyArray = await response.json();
            const currentResult = historyArray[historyArray.length - 1];

            // Добавляем точку в память графики и сразу рисуем
            currentPoints.push({ x: currentResult.x, y: currentResult.y });
            drawPoint(currentResult.x, currentResult.y, currentR);

            // Перерисовываем всю таблицу и обновляем кэш
            updateTable(historyArray);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(historyArray));

        } catch (error) {
          console.error('Ошибка при обращении к FastCGI-серверу:', error);
          setOfflineStatus();
        }
    }
});

document.getElementById('clearBtn').addEventListener('click', async () => {
      try {
          await fetch('/fcgi-bin/server.jar?clear=1', { method: 'GET' });
      } catch (e) {
        console.error('Ошибка при очистке сервера:', e);
        setOfflineStatus
      }

      localStorage.removeItem(STORAGE_KEY);
      currentPoints = [];
      updateTable([]);
      drawGraph(currentR);
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
