function sendMessageInPopup(phone, msg) {
  const phoneFormatted = phone.startsWith('+') ? phone : `+${phone}`;
  const url = `https://web.whatsapp.com/send?phone=${phoneFormatted.slice(1)}&text=${encodeURIComponent(msg)}`;

  chrome.windows.create({ url: url, type: 'popup', width: 900, height: 800 }, (win) => {
    setTimeout(() => {
      if (!win.tabs || !win.tabs[0]) return;
      chrome.scripting.executeScript({
        target: { tabId: win.tabs[0].id },
        func: () => {
          function findAndClickSend() {
            let sendButton = document.querySelector('span[data-icon="send"]');
            if (sendButton) {
              sendButton = sendButton.closest('button');
              if (sendButton) {
                sendButton.click();
                return true;
              }
            }

            const messageInput = document.querySelector('div[contenteditable="true"]');
            if (messageInput && messageInput.textContent.trim().length > 0) {
              messageInput.focus();
              const enterEvent = new KeyboardEvent('keydown', {
                key: 'Enter',
                keyCode: 13,
                which: 13,
                bubbles: true
              });
              messageInput.dispatchEvent(enterEvent);
              return true;
            }
            return false;
          }

          let attempts = 0;
          const interval = setInterval(() => {
            if (findAndClickSend()) {
              clearInterval(interval);
              console.log("✅ Message sent");
            } else if (++attempts > 30) {
              clearInterval(interval);
              console.warn("❌ Could not send message");
            }
          }, 1000);
        }
      });
    }, 8000);
  });
}

document.addEventListener("DOMContentLoaded", () => {
  const sendBtn = document.getElementById("sendBtn");
  const bulkBtn = document.getElementById("bulkBtn");
  const status = document.getElementById("status");

  sendBtn.addEventListener("click", () => {
    const phone = document.getElementById("phone").value.trim().replace(/[^\d+]/g, '');
    const msg = document.getElementById("message").value.trim();

    if (!phone || !msg) {
      status.textContent = "Fill both fields.";
      status.className = 'status error';
      status.style.display = 'block';
      return;
    }

    status.textContent = "Opening WhatsApp...";
    status.className = 'status success';
    status.style.display = 'block';

    sendMessageInPopup(phone, msg);
  });

  bulkBtn.addEventListener("click", async () => {
    const fileInput = document.getElementById("csvUpload");
    const file = fileInput.files[0];
    if (!file) return alert("Please select a CSV file.");

    const text = await file.text();
    const rows = text.trim().split("\n");
    const headers = rows[0].split(",").map(h => h.trim().toLowerCase());

    for (let i = 1; i < rows.length; i++) {
      const values = rows[i].split(",").map(v => v.trim());
      const entry = Object.fromEntries(headers.map((h, idx) => [h, values[idx]]));
      if (!entry.phone || !entry.message) continue;

      status.textContent = `Sending to ${entry.phone} (${i}/${rows.length - 1})`;
      status.className = 'status success';
      status.style.display = 'block';

      sendMessageInPopup(entry.phone, entry.message);
      await new Promise(r => setTimeout(r, 5000 + Math.random() * 7000));
    }

    status.textContent = "✅ Bulk sending complete!";
  });
});
