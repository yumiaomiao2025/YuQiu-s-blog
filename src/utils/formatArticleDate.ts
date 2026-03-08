import dayjs from 'dayjs'
import 'dayjs/locale/zh-cn'

dayjs.locale('zh-cn')

export function formatArticleDate(date: string) {
  return dayjs(date).format('YYYY年M月D日 dddd')
}
