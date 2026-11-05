export function foodPhotoSource(category:string,fallback:string|undefined,width=400){
  const photo=category==='coffee'||category==='카페'?'coffee':category==='burger'||category==='버거'?'burger':null
  return photo?`${import.meta.env.BASE_URL}images/${photo}.jpg`:`https://images.unsplash.com/photo-${fallback??'1528735602780-2552fd46c7af'}?auto=format&fit=crop&w=${width}&q=85`
}
