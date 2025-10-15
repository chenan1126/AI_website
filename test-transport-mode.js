// 測試交通模式檢測修復
import dotenv from 'dotenv';
dotenv.config();

import { calculateRouteDistanceAndTimeSync } from './api/_utils.js';

async function testTransportMode() {
    console.log('🧪 測試交通模式檢測修復\n');
    
    const testCases = [
        {
            name: '北港觀光大橋 → 阿坤師土魠魚羹',
            origin: '北港觀光大橋',
            destination: '阿坤師土魠魚羹',
            expectedMode: 'driving',
            description: '同縣市景點，應使用開車模式'
        },
        {
            name: '鼓山渡輪站 → 旗津',
            origin: '鼓山渡輪站',
            destination: '旗津',
            expectedMode: 'transit',
            description: '需要搭渡輪，應使用大眾運輸'
        },
        {
            name: '高雄港 → 駁二藝術特區',
            origin: '高雄港',
            destination: '駁二藝術特區',
            expectedMode: 'transit',
            description: '港口區域，應使用大眾運輸'
        },
        {
            name: '台北101 → 淡水老街',
            origin: '台北101',
            destination: '淡水老街',
            expectedMode: 'driving',
            description: '一般景點，應使用開車模式'
        },
        {
            name: '南港展覽館 → 信義區',
            origin: '南港展覽館',
            destination: '信義區',
            expectedMode: 'driving',
            description: '雖然有"港"字但是地名，應使用開車'
        }
    ];

    console.log('開始測試...\n');

    for (const testCase of testCases) {
        console.log(`📍 測試: ${testCase.name}`);
        console.log(`   說明: ${testCase.description}`);
        console.log(`   預期模式: ${testCase.expectedMode}`);
        
        const result = await calculateRouteDistanceAndTimeSync(
            testCase.origin,
            testCase.destination
        );
        
        if (result.error) {
            console.log(`   ❌ 錯誤: ${result.error}\n`);
            continue;
        }
        
        const actualMode = result.mode;
        const isCorrect = actualMode === testCase.expectedMode;
        
        console.log(`   實際模式: ${actualMode}`);
        console.log(`   距離: ${result.distance_text}`);
        console.log(`   時間: ${result.duration_text}`);
        console.log(`   ${isCorrect ? '✅ 通過' : '❌ 失敗'}\n`);
    }
    
    console.log('測試完成！');
}

testTransportMode().catch(console.error);
