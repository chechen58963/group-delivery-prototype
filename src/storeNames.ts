const franchiseNames=['메가MGC커피','컴포즈커피','이디야커피','써브웨이','맘스터치','빽다방','롯데리아','더벤티']
// Presentation only: keep existing catalogue keys and historical order links intact.
export function displayStoreName(name:string|null|undefined){
  const value=name?.trim()??''
  return franchiseNames.find(brand=>value===brand||value.startsWith(brand+' '))??value
}
