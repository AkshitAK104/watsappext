(function () {
  if (document.getElementById('whatsblitz-sidebar')) return; // Prevent reinjection

  const sidebar = document.createElement('div');
  sidebar.id = 'whatsblitz-sidebar';
  sidebar.innerHTML = `
    <div class="wb-header">📤 WhatsBlitz Bulk Sender</div>
    <input type="file" id="excelUpload" accept=".xlsx,.csv" />
    <button id="startBulk">Start Bulk Send</button>
    <div id="bulkStatus"></div>
    <div id="progressBarContainer"><div id="progressBar"></div></div>
  `;
  document.body.appendChild(sidebar);

  const statusBox = document.getElementById('bulkStatus');
  const progressBar = document.getElementById('progressBar');
  let contactList = [];

  document.getElementById('excelUpload').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data, { type: 'array' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    contactList = XLSX.utils.sheet_to_json(sheet);
    statusBox.textContent = `Loaded ${contactList.length} contacts.`;
  });

  document.getElementById('startBulk').addEventListener('click', async () => {
    if (!contactList.length) return alert('Please upload a valid Excel file.');
    for (let i = 0; i < contactList.length; i++) {
      const entry = contactList[i];
      const msg = entry.message.replace(/{{(\w+)}}/g, (_, key) => entry[key] || '');
      const phone = ('' + entry.phone).replace(/[^\d]/g, '');
      if (!/^\d{7,15}$/.test(phone)) continue;

      const url = `https://web.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(msg)}`;
      window.open(url, '_blank');
      statusBox.textContent = `Sending to ${entry.name || phone}... (${i + 1}/${contactList.length})`;
      progressBar.style.width = `${((i + 1) / contactList.length) * 100}%`;
      await new Promise(r => setTimeout(r, 5000 + Math.random() * 10000));
    }
    statusBox.textContent = '✅ All messages processed';
  });
})();