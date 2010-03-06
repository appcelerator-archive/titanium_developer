Dashboard = {};

// setup event handler
Dashboard.eventHandler = function(event)
{
	if (!TiDev.dashboardAdContent)
	{
		TiDev.setDashboardContent = true;
		return;
	}
	if (event == 'focus')
	{
		$('#dashboard').html(TiDev.dashboardAdContent);
	}
	else if (event == 'load')
	{
		$('#dashboard').html(TiDev.dashboardAdContent);
	}
};



// register module
TiDev.registerModule({
	name:'dashboard',
	displayName: 'Dashboard',
	perspectives:['projects'],
	html:'dashboard.html',
	idx:0,
	callback:Dashboard.eventHandler
});

