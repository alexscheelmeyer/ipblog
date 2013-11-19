var crypto=require('crypto');

function makeHash(str){
	var hash=crypto.createHash('sha1');
	hash.update(str);
	return hash.digest('hex');
}

var Article=module.exports=function(title,url,content,author,published,publishDate){
	this.title=title;
	this.url=url;
	this.content=content;
	this.author=author;
	this.published=(published===true) ? true : false;
	this.id=makeHash(title+content);
	this.publishDate=null;
	if(this.published && publishDate!==undefined)this.publishDate=publishDate;
	this.images=[];
	this.titleImage='';
	this.category='';
	this.tags=[];
	this.modifiers=[];
};

