// Tab switching functionality
function initializeTabs() {
  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');

  tabBtns.forEach(btn => {
    btn.addEventListener('click', function() {
      const targetTab = this.getAttribute('data-tab');
      
      // Remove active class from all tabs and contents
      tabBtns.forEach(b => b.classList.remove('active'));
      tabContents.forEach(c => c.classList.remove('active'));
      
      // Add active class to clicked tab and corresponding content
      this.classList.add('active');
      document.getElementById(targetTab).classList.add('active');
    });
  });
}

// CSV processing functionality
let csvData = [];

function parseCSV(text) {
  const lines = text.trim().split('\n');
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
  const data = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim());
    if (values.length >= headers.length) {
      const row = {};
      headers.forEach((header, index) => {
        row[header] = values[index] || '';
      });
      data.push(row);
    }
  }
  
  return data;
}

function displayPreview(data) {
  const previewSection = document.getElementById('csvPreview');
  const previewList = document.getElementById('previewList');
  
  previewList.innerHTML = '';
  
  const displayCount = Math.min(data.length, 5);
  
  for (let i = 0; i < displayCount; i++) {
    const contact = data[i];
    const item = document.createElement('div');
    item.className = 'preview-item';
    
    const personalizedMessage = contact.message ? 
      contact.message.replace(/\{\{name\}\}/gi, contact.name || 'Friend') : '';
    
    item.innerHTML = `
      <div class="contact-info">
        <strong>${contact.name || 'Unknown'}</strong>
        <span class="phone">${contact.phone || 'No phone'}</span>
      </div>
      <div class="message-preview">${personalizedMessage.substring(0, 100)}${personalizedMessage.length > 100 ? '...' : ''}</div>
    `;
    
    previewList.appendChild(item);
  }
  
  if (data.length > 5) {
    const moreItem = document.createElement('div');
    moreItem.className = 'more-contacts';
    moreItem.textContent = `... and ${data.length - 5} more contacts`;
    previewList.appendChild(moreItem);
  }
  
  previewSection.style.display = 'block';
}

function showStatus(message, type = 'success') {
  const status = document.getElementById('uploadStatus');
  status.textContent = message;
  status.className = `upload-status ${type}`;
  status.style.display = 'block';
  
  setTimeout(() => {
    status.style.display = 'none';
  }, 5000);
}

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

// Main initialization
document.addEventListener("DOMContentLoaded", () => {
  // Initialize tabs first
  initializeTabs();
  
  // Get elements
  const messageForm = document.getElementById("messageForm");
  const phoneNumber = document.getElementById("phoneNumber");
  const message = document.getElementById("message");
  const openWhatsApp = document.getElementById("openWhatsApp");
  const debugSend = document.getElementById("debugSend");
  const csvUpload = document.getElementById("csvUpload");
  const startBulkSend = document.getElementById("startBulkSend");
  const clearData = document.getElementById("clearData");
  const status = document.getElementById("status");
  
  // Single message form handler
  if (messageForm) {
    messageForm.addEventListener("submit", (e) => {
      e.preventDefault();
      
      const phone = phoneNumber.value.trim().replace(/[^\d+]/g, '');
      const msg = message.value.trim();
      
      if (!phone || !msg) {
        status.textContent = "Please fill both phone number and message fields.";
        status.className = 'status-message error';
        status.style.display = 'block';
        return;
      }
      
      status.textContent = "Opening WhatsApp...";
      status.className = 'status-message success';
      status.style.display = 'block';
      
      sendMessageInPopup(phone, msg);
    });
  }
  
  // Open WhatsApp Web button
  if (openWhatsApp) {
    openWhatsApp.addEventListener("click", () => {
      chrome.tabs.create({ url: "https://web.whatsapp.com" });
    });
  }
  
  // Debug send button
  if (debugSend) {
    debugSend.addEventListener("click", () => {
      const phone = phoneNumber.value.trim();
      const msg = message.value.trim();
      
      if (!phone || !msg) {
        alert("Please fill both fields for debug send.");
        return;
      }
      
      console.log("Debug Send:", { phone, message: msg });
      alert(`Debug mode - would send to: ${phone}\nMessage: ${msg}`);
    });
  }
  
  // CSV file upload handler
  if (csvUpload) {
    csvUpload.addEventListener("change", async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      
      try {
        const text = await file.text();
        csvData = parseCSV(text);
        
        if (csvData.length === 0) {
          showStatus("No valid data found in CSV file", "error");
          return;
        }
        
        // Validate required columns
        const requiredColumns = ['name', 'phone', 'message'];
        const hasRequiredColumns = requiredColumns.every(col => 
          csvData[0].hasOwnProperty(col)
        );
        
        if (!hasRequiredColumns) {
          showStatus("CSV must have 'name', 'phone', and 'message' columns", "error");
          return;
        }
        
        displayPreview(csvData);
        startBulkSend.disabled = false;
        showStatus(`Successfully loaded ${csvData.length} contacts`, "success");
        
        // Update file info
        const fileInfo = document.getElementById('fileInfo');
        if (fileInfo) {
          fileInfo.textContent = `${file.name} (${csvData.length} contacts)`;
        }
        
      } catch (error) {
        showStatus("Error reading CSV file", "error");
        console.error("CSV parsing error:", error);
      }
    });
  }
  
  // Clear data button
  if (clearData) {
    clearData.addEventListener("click", () => {
      csvData = [];
      csvUpload.value = '';
      document.getElementById('csvPreview').style.display = 'none';
      document.getElementById('fileInfo').textContent = '';
      startBulkSend.disabled = true;
      showStatus("Data cleared", "success");
    });
  }
  
  // Bulk send handler with improved queue management
  if (startBulkSend) {
    startBulkSend.addEventListener("click", async () => {
      if (csvData.length === 0) {
        alert("Please upload a CSV file first.");
        return;
      }
      
      const confirmSend = confirm(`Send messages to ${csvData.length} contacts? This will open one popup at a time to avoid conflicts.`);
      if (!confirmSend) return;
      
      startBulkSend.disabled = true;
      
      // Prepare contacts with personalized messages
      const contacts = csvData.map(contact => ({
        name: contact.name || 'Friend',
        phone: contact.phone,
        message: contact.message.replace(/\{\{name\}\}/gi, contact.name || 'Friend')
      })).filter(contact => contact.phone && contact.message);
      
      status.textContent = `Starting bulk send for ${contacts.length} contacts...`;
      status.className = 'status-message success';
      status.style.display = 'block';
      
      // Send to background script for queue management
      chrome.runtime.sendMessage({
        action: "sendBulkMessage",
        contacts: contacts
      }, (response) => {
        if (response && response.success) {
          status.textContent = "✅ Bulk sending initiated! Messages will be sent one by one.";
          setTimeout(() => {
            startBulkSend.disabled = false;
          }, 5000);
        }
      });
    });
  }
});
