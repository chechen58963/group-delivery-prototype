// Pickup method actions have a separate API; pickup acknowledgement is an order action.
const pickupMethodActions = new Set(['pickup-propose', 'pickup-agree', 'pickup-reset', 'pickup-dropoff'])
export function orderActionRequest(action:string, postId:string, data:Record<string,unknown>={}) {
  if(pickupMethodActions.has(action))return {name:'gd_pickup_action',args:{p_action:action.slice(7),p_post:postId,p_data:data}}
  if(action==='room-time')return {name:'gd_update_room_time_checked',args:{p_post:postId,p_start:data.start,p_end:data.end,p_expected:data.expected??null}}
  return {name:'gd_order_action',args:{p_action:action,p_post:postId,p_data:data}}
}
