export const EMOTION_OPTIONS = [
  { value: 'neutral', emoji: '😐', label: 'ปกติ' },
  { value: 'happy', emoji: '😊', label: 'มีความสุข' },
  { value: 'laugh', emoji: '😆', label: 'ขำ / สนุก' },
  { value: 'embarrassed', emoji: '😳', label: 'เขินอาย' },
  { value: 'annoyed', emoji: '😒', label: 'หงุดหงิด / รำคาญ' },
  { value: 'sad', emoji: '😢', label: 'เศร้า' },
  { value: 'thinking', emoji: '🤔', label: 'ครุ่นคิด / กังวล' },
  { value: 'surprised', emoji: '😲', label: 'ตกใจ / ประหลาดใจ' }
];

export const getEmotionEmoji = (emotion, isUser = false) => {
  switch (emotion) {
    case 'happy': return '😊';
    case 'laugh': return '😆';
    case 'embarrassed': return '😳';
    case 'annoyed': return '😒';
    case 'sad': return '😢';
    case 'thinking': return '🤔';
    case 'surprised': return '😲';
    case 'neutral':
      return isUser ? '😐' : '👧';
    default:
      return isUser ? null : '👧';
  }
};
