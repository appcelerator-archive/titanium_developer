Quotas = {};
Quotas.buttonBar =  new TiUI.BlackButtonBar();

Quotas.setupView = function()
{
	TiUI.setBackgroundColor('#1c1c1c');
	TiDev.contentLeft.hide();
	TiDev.contentLeftHideButton.hide();
	TiDev.contentLeftShowButton.hide();		

	// configure button bar
	Quotas.buttonBar.configure({id:'tiui_content_submenu',tabs:['Summary','Desktop','Mobile'],active:0,});

	// add tab click listener
	Quotas.buttonBar.addListener(function(idx)
	{
		if (idx == 0)
		{
			$('#quota_title').html('Cloud Usage Summary');
			$('#quota_title').css('left','-20px');
			$('#quota_image_mobile').css('display','none');
			$('#quota_image_desktop').css('display','none');
			$('#quota_image_summary').css('display','inline');

		}
		else if (idx == 1)
		{
			$('#quota_title').html('Desktop Cloud Usage');
			$('#quota_title').css('left','5px');
			$('#quota_image_mobile').css('display','none');
			$('#quota_image_summary').css('display','none');
			$('#quota_image_desktop').css('display','inline');
		}
		else 
		{
			$('#quota_title').html('Mobile Cloud Usage');
			$('#quota_title').css('left','5px');
			$('#quota_image_desktop').css('display','none');
			$('#quota_image_summary').css('display','none');
			$('#quota_image_mobile').css('display','inline');
		}
	});


	App.createControl('1','jquery_progressbar',{value:1},function()
	{
		
	});
	App.createControl('2','jquery_progressbar',{value:1},function()
	{
		
	});
	App.createControl('3','jquery_progressbar',{value:1},function()
	{
		
	});
	App.createControl('4','jquery_progressbar',{value:1},function()
	{
		
	});

}
// setup event handler
Quotas.eventHandler = function(event)
{
	if (event == 'focus')
	{
		Quotas.setupView();
	}
	else if (event == 'load')
	{
		Quotas.setupView();
	}
	else
	{
		Quotas.buttonBar.hide()
	}
};


// register module
TiDev.registerModule({
	name:'quotas',
	displayName: 'Quotas',
	perspectives:['profile'],
	html:'quotas.html',
	idx:1,
	callback:Quotas.eventHandler
});