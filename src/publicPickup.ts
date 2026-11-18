export function validPublicPickup(point:{lat:number;lng:number}|null|undefined){
  return !!point&&Number.isFinite(point.lat)&&Number.isFinite(point.lng)&&Math.abs(point.lat)<=90&&Math.abs(point.lng)<=180
}
