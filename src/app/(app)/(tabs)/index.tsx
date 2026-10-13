import { ScrollView } from 'react-native';

import { ComingSoon } from '@/components/ComingSoon';

export default function EncyclopediaTab() {
  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic">
      <ComingSoon icon="book-outline" title="図鑑" description="コミュニティで確定した生き物の記録を見られます" />
    </ScrollView>
  );
}
