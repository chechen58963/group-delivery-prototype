export function authErrorMessage(error: {code?:string;message?:string}) {
  if(error.code==='over_email_send_rate_limit') return '가입 인증 메일의 발송 한도에 도달했어요. 운영자가 메일 발송 설정을 확인해야 해요. 입력한 정보는 그대로 두고 잠시 후 다시 시도해 주세요.'
  if(error.code==='over_request_rate_limit'||error.code==='over_email_send_rate_limit_same_user') return '짧은 시간에 인증 요청이 반복됐어요. 잠시 기다린 뒤 다시 시도해 주세요.'
  if(['email_address_not_authorized','email_address_not_allowed'].includes(error.code??'')) return '이 이메일로 인증 메일을 보낼 수 없어요. 운영자에게 메일 발송 설정 확인을 요청해 주세요.'
  return null
}
