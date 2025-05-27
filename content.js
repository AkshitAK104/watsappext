(function () {
  // Prevent multiple injections
  if (document.getElementById('whatsblitz-sidebar')) return;

  // Wait for page to be fully loaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeSidebar);
  } else {
    initializeSidebar();
  }

  function initializeSidebar() {
    // Additional check after DOM is ready
    if (document.getElementById('whatsblitz-sidebar')) return;

    const sidebar = document.createElement('div');
    sidebar.id = 'whatsblitz-sidebar';
    
    sidebar.innerHTML = `
      <div class="wb-header">⚡ WhatsBlitz Quick Access ⚡</div>
      
      <div style="margin: 15px 0;">
        <label style="color: #00ffff; font-weight: 600; font-size: 13px; display: block; margin-bottom: 8px;">
          📁 Quick CSV Upload
        </label>
        <input type="file" id="wb-csv-upload" accept=".csv,.xlsx" />
        <div id="wb-file-info" style="margin-top: 8px; color: rgba(255, 255, 255, 0.7); font-size: 12px;"></div>
      </div>
      
      <div id="wb-preview" style="display: none; margin: 15px 0;">
        <div style="background: rgba(0, 255, 255, 0.1); padding: 10px; border-radius: 8px; border-left: 3px solid #00ffff;">
          <div style="color: #00ffff; font-weight: 600; font-size: 12px; margin-bottom: 5px;">📋 Preview</div>
          <div id="wb-preview-content" style="color: rgba(255, 255, 255, 0.8); font-size: 11px;"></div>
        </div>
      </div>
      
      <button id="wb-bulk-send" disabled style="
        width: 100%; 
        padding: 12px; 
        background: linear-gradient(135deg, rgba(0, 255, 255, 0.2) 0%, rgba(0, 255, 127, 0.2) 100%); 
        border: 2px solid #00ffff; 
        border-radius: 10px; 
        color: #ffffff; 
        font-weight: 700; 
        cursor: pointer; 
        transition: all 0.4s ease;
        font-size: 13px;
        text-transform: uppercase;
        letter-spacing: 1px;
        margin: 15px 0;
      ">
        🚀 Start Bulk Send
      </button>
      
      <button id="wb-open-extension" style="
        width: 100%; 
        padding: 10px; 
        background: linear-gradient(135deg, rgba(255, 0, 255, 0.2) 0%, rgba(0, 255, 255, 0.2) 100%); 
        border: 2px solid #ff00ff; 
        border-radius: 10px; 
        color: #ffffff; 
        font-weight: 600; 
        cursor: pointer; 
        transition: all 0.4s ease;
        font-size: 12px;
        margin-bottom: 15px;
      ">
        🎛️ Open Full Extension
      </button>
      
      <div id="wb-status" style="
        padding: 8px 12px; 
        border-radius: 8px; 
        margin: 10px 0; 
        font-size: 12px; 
        text-align: center; 
        display: none;
        font-weight: 500;
      "></div>
      
      <button id="wb-close" style="
        position: absolute; 
        top: 10px; 
        right: 15px; 
        background: rgba(255, 0, 100, 0.3); 
        border: 1px solid #ff0064; 
        color: #ff0064; 
        width: 25px; 
        height: 25px; 
        border-radius: 50%; 
        cursor: pointer; 
        font-size: 14px; 
        font-weight: bold;
        transition: all 0.3s ease;
      ">×</button>
    `;
    
    document.body.appendChild(sidebar);
    
    // Add event listeners
    setupSidebarEvents();
  }

  function setupSidebarEvents() {
    const csvUpload = document.getElementById('wb-csv-upload');
    const bulkSend = document.getElementById('wb-bulk-send');
    const openExtension = document.getElementById('wb-open-extension');
    const closeBtn = document.getElementById('wb-close');
    
    let sidebarData = [];
    
    // CSV Upload handler
    if (csvUpload) {
      csvUpload.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        try {
          const text = await file.text();
          sidebarData = parseCSVData(text);
          
          if (sidebarData.length > 0) {
            displaySidebarPreview(sidebarData);
            bulkSend.disabled = false;
            showSidebarStatus(`Loaded ${sidebarData.length} contacts`, 'success');
          } else {
            showSidebarStatus('No valid data found', 'error');
          }
        } catch (error) {
          showSidebarStatus('Error reading file', 'error');
        }
      });
    }
    
    // Bulk send handler
    if (bulkSend) {
      bulkSend.addEventListener('click', () => {
        if (sidebarData.length === 0) return;
        
        const confirmed = confirm(`Send messages to ${sidebarData.length} contacts?`);
        if (!confirmed) return;
        
        bulkSend.disabled = true;
        showSidebarStatus('Starting bulk send...', 'success');
        
        // Send to background script
        chrome.runtime.sendMessage({
          action: "sendBulkMessage",
          contacts: sidebarData.map(contact => ({
            name: contact.name || 'Friend',
            phone: contact.phone,
            message: contact.message.replace(/\{\{name\}\}/gi, contact.name || 'Friend')
          }))
        });
      });
    }
    
    // Open extension handler
    if (openExtension) {
      openExtension.addEventListener('click', () => {
        chrome.runtime.sendMessage({action: "openExtension"});
      });
    }
    
    // Close sidebar handler
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        const sidebar = document.getElementById('whatsblitz-sidebar');
        if (sidebar) {
          sidebar.style.animation = 'slideOutNeon 0.5s ease-in forwards';
          setTimeout(() => {
            sidebar.remove();
          }, 500);
        }
      });
    }
  }
  
  function parseCSVData(text) {
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
        if (row.phone && row.message) {
          data.push(row);
        }
      }
    }
    
    return data;
  }
  
  function displaySidebarPreview(data) {
    const preview = document.getElementById('wb-preview');
    const content = document.getElementById('wb-preview-content');
    
    if (data.length > 0) {
      const sample = data[0];
      content.innerHTML = `
        <strong>${sample.name || 'Unknown'}</strong><br>
        ${sample.phone}<br>
        <em>${(sample.message || '').substring(0, 50)}...</em>
        ${data.length > 1 ? `<br><small>+${data.length - 1} more contacts</small>` : ''}
      `;
      preview.style.display = 'block';
    }
  }
  
  function showSidebarStatus(message, type) {
    const status = document.getElementById('wb-status');
    status.textContent = message;
    status.className = type === 'success' ? 
      'background: rgba(0, 255, 127, 0.2); color: #00ff7f; border: 1px solid rgba(0, 255, 127, 0.4);' :
      'background: rgba(255, 0, 100, 0.2); color: #ff0064; border: 1px solid rgba(255, 0, 100, 0.4);';
    status.style.cssText += status.className;
    status.style.display = 'block';
    
    setTimeout(() => {
      status.style.display = 'none';
    }, 3000);
  }
})();

// Add slide out animation
const style = document.createElement('style');
style.textContent = `
  @keyframes slideOutNeon {
    from {
      transform: translateX(0) scale(1);
      opacity: 1;
    }
    to {
      transform: translateX(100%) scale(0.8);
      opacity: 0;
    }
  }
`;
document.head.appendChild(style);
