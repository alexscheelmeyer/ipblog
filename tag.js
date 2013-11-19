var crypto=require('crypto');

function makeHash(str){
	var hash=crypto.createHash('sha1');
	hash.update(str);
	return hash.digest('hex');
}

var Tag=module.exports=function(kind,name){
	this.kind=kind;
	this.name=name;
	this.articles=[];
	this.id=kind+'-'+name;
}

Tag.prototype.addArticle=function(article){
	this.articles.push(article);
}

Tag.prototype.equals=function(otherTag){
	if(otherTag===undefined)return false;
	if(otherTag===null)return false;
	return (otherTag.kind===this.kind)&&(this.name===otherTag.name);
}
