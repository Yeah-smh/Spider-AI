// 蜘蛛侠壁纸配置
// 使用 Unsplash 的高质量免费图片

export const spiderWallpapers = [
  {
    id: 1,
    name: '城市守望者',
    url: 'https://images.unsplash.com/photo-1635863138275-d9b33299680b?q=80&w=3840&auto=format&fit=crop',
    description: '蜘蛛侠站在城市之巅'
  },
  {
    id: 2,
    name: '夜幕降临',
    url: 'https://images.unsplash.com/photo-1608889476561-6242cfdbf622?q=80&w=3840&auto=format&fit=crop',
    description: '纽约夜景，蜘蛛侠剪影'
  },
  {
    id: 3,
    name: '蛛丝飞扬',
    url: 'https://images.unsplash.com/photo-1612036782180-6f0b6cd846fe?q=80&w=3840&auto=format&fit=crop',
    description: '蜘蛛侠穿梭于城市间'
  },
  {
    id: 4,
    name: '英雄归来',
    url: 'https://images.unsplash.com/photo-1635805737707-575885ab0820?q=80&w=3840&auto=format&fit=crop',
    description: '蜘蛛侠经典姿态'
  }
]

// 默认壁纸
export const defaultWallpaper = spiderWallpapers[0]

// 随机获取壁纸
export const getRandomWallpaper = () => {
  const randomIndex = Math.floor(Math.random() * spiderWallpapers.length)
  return spiderWallpapers[randomIndex]
}
