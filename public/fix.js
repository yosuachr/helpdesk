// patch refresh
document.getElementById('btn-refresh').onclick = function() {
  var btn = document.getElementById('btn-refresh');
  btn.textContent = '⏳';
  btn.disabled = true;
  var x = new XMLHttpRequest();
  x.open('GET', '/api/tickets');
  x.setRequestHeader('Content-Type', 'application/json');
  x.onload = function() {
    allTickets = JSON.parse(x.responseText);
    var now = new Date();
    var h = now.getHours().toString().padStart(2,'0');
    var m = now.getMinutes().toString().padStart(2,'0');
    var s = now.getSeconds().toString().padStart(2,'0');
    document.getElementById('refresh-status').textContent = 'Update: '+h+':'+m+':'+s;
    renderDashboard();
    btn.textContent = '↻ Refresh';
    btn.disabled = false;
  };
  x.send();
};
