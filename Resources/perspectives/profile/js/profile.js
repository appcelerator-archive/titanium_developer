Profile = {};

Profile.eventHandler = function(event)
{
	if (event == 'focus')
	{
		TiDev.subtabs.setLeftPadding(0);
	}
	else
	{
		// do nothing right now
	}
}
TiDev.registerPerspective({
	name:'profile',
	image:'perspectives/profile/images/profile.png',
	activeImage:'perspectives/profile/images/profile_active.png',
	callback:Profile.eventHandler,
	imageTitle:'Profile',
	idx:2,
	views:[]
})	
