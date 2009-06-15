Community = {};

Community.eventHandler = function(event)
{
	if (event == 'focus')
	{
		// do nothing right now
	}
	else
	{
		// do nothing right now
	}
}
TiDev.registerPerspective({
	name:'community',
	image:'perspectives/community/images/community.png',
	activeImage:'perspectives/community/images/community_active.png',
	callback:Community.eventHandler,
	imageTitle:'Community',
	idx:1,
	views:[]
})	
