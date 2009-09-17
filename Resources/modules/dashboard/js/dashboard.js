

Dashboard = {
	eventHandler: function()
	{
		
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

