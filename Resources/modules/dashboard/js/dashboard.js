Dashboard = {};
Dashboard.pages = ['23.html','25.html'];
Dashboard.url = 'http://www.appcelerator.com/banner/' + ((TiDev.accountType == 'community')?Dashboard.pages[0]:Dashboard.pages[1]);
Dashboard.content = null;

// setup event handler
Dashboard.eventHandler = function(event)
{
	if (event == 'focus')
	{
		$('#dashboard').html(Dashboard.content);
	}
	else if (event == 'load')
	{
		$('#dashboard').html(Dashboard.content);
	}
};

$.get(Dashboard.url, function(d)
{
	var parser = new DOMParser();
	var doc = parser.parseFromString(d, "text/xml");
	Dashboard.content = doc.body.innerHTML;
});


// register module
TiDev.registerModule({
	name:'dashboard',
	displayName: 'Dashboard',
	perspectives:['projects'],
	html:'dashboard.html',
	idx:0,
	callback:Dashboard.eventHandler
});

