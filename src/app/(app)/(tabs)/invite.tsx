import { ScrollView } from 'react-native';

import { ComingSoon } from '@/components/ComingSoon';

export default function InviteTab() {
  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic">
      <ComingSoon icon="person-add-outline" title="招待" description="招待リンクを作って、メンバーをコミュニティに招待できます" />
    </ScrollView>
  );
}
