Dashboard = {};

// setup event handler
Dashboard.eventHandler = function(event)
{
	if (!TiDev.dashboardAdContent && TiDev.isCommunity != null)
	{
		TiDev.setDashboardContent = true;
		return;
	}
	else if (TiDev.isCommunity == null)
	{
		$('#dashboard_offline').css('display','block');
		return;
	}
	if (event == 'focus' || event == 'load')
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

