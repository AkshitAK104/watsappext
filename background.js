// Auto-open extension when WhatsApp Web is accessed
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url && tab.url.includes('web.whatsapp.com')) {
    // Small delay to ensure page is fully loaded
    setTimeout(() => {
      chrome.action.openPopup();
    }, 2000);
  }
});

// Handle bulk messaging with proper window management
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "sendBulkMessage") {
    sendBulkMessageWithQueue(request.contacts);
    sendResponse({success: true});
  }
});

let messageQueue = [];
let isProcessing = false;
let currentWindow = null;

async function sendBulkMessageWithQueue(contacts) {
  messageQueue = [...contacts];
  if (!isProcessing) {
    processNextMessage();
  }
}

async function processNextMessage() {
  if (messageQueue.length === 0) {
    isProcessing = false;
    // Close current window if exists
    if (currentWindow) {
      chrome.windows.remove(currentWindow.id);
      currentWindow = null;
    }
    return;
  }

  isProcessing = true;
  const contact = messageQueue.shift();
  
  // Close previous window if exists
  if (currentWindow) {
    try {
      await chrome.windows.remove(currentWindow.id);
    } catch (e) {
      console.log("Previous window already closed");
    }
    currentWindow = null;
  }

  const phoneFormatted = contact.phone.startsWith('+') ? contact.phone : `+${contact.phone}`;
  const url = `https://web.whatsapp.com/send?phone=${phoneFormatted.slice(1)}&text=${encodeURIComponent(contact.message)}`;
  
  // Create new window
  chrome.windows.create({ 
    url: url, 
    type: 'popup', 
    width: 900, 
    height: 800,
    focused: true
  }, (win) => {
    currentWindow = win;
    
    setTimeout(() => {
      if (!win.tabs || !win.tabs[0]) {
        processNextMessage();
        return;
      }
      
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
              // Signal completion
              window.messageCompleted = true;
            } else if (++attempts > 30) {
              clearInterval(interval);
              console.warn("❌ Could not send message");
              window.messageCompleted = true;
            }
          }, 1000);
        }
      });
      
      // Wait for message completion then process next
      const checkCompletion = setInterval(() => {
        chrome.scripting.executeScript({
          target: { tabId: win.tabs[0].id },
          func: () => window.messageCompleted
        }, (result) => {
          if (result && result[0] && result[0].result) {
            clearInterval(checkCompletion);
            setTimeout(() => {
              processNextMessage();
            }, 3000); // 3 second delay before next message
          }
        });
      }, 1000);
      
      // Fallback timeout
      setTimeout(() => {
        clearInterval(checkCompletion);
        processNextMessage();
      }, 15000);
      
    }, 8000);
  });
}
