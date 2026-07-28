/* v2.4 coordinate conversion service. */
function outOfChina(lat,lng){return lng<72.004||lng>137.8347||lat<0.8293||lat>55.8271}
function transformLat(x,y){let r=-100+2*x+3*y+.2*y*y+.1*x*y+.2*Math.sqrt(Math.abs(x));r+=(20*Math.sin(6*x*Math.PI)+20*Math.sin(2*x*Math.PI))*2/3;r+=(20*Math.sin(y*Math.PI)+40*Math.sin(y/3*Math.PI))*2/3;r+=(160*Math.sin(y/12*Math.PI)+320*Math.sin(y*Math.PI/30))*2/3;return r}
function transformLng(x,y){let r=300+x+2*y+.1*x*x+.1*x*y+.1*Math.sqrt(Math.abs(x));r+=(20*Math.sin(6*x*Math.PI)+20*Math.sin(2*x*Math.PI))*2/3;r+=(20*Math.sin(x*Math.PI)+40*Math.sin(x/3*Math.PI))*2/3;r+=(150*Math.sin(x/12*Math.PI)+300*Math.sin(x/30*Math.PI))*2/3;return r}
function wgs84ToGcj02(lat,lng){if(outOfChina(lat,lng))return[lat,lng];const a=6378245,ee=.00669342162296594323,dLat=transformLat(lng-105,lat-35),dLng=transformLng(lng-105,lat-35),rad=lat/180*Math.PI,magic=1-ee*Math.sin(rad)*Math.sin(rad),sqrt=Math.sqrt(magic);return[lat+(dLat*180)/((a*(1-ee))/(magic*sqrt)*Math.PI),lng+(dLng*180)/(a/sqrt*Math.cos(rad)*Math.PI)]}
window.TravelCoordinates=Object.freeze({outOfChina,transformLat,transformLng,wgs84ToGcj02});
