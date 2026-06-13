export const sampleOkxWorldCupPayload = {
  events: [
    {
      eventId: "sample-world-cup-2026",
      eventTitle: "2026 FIFA World Cup",
      markets: [
        {
          marketId: "sample-spain-champion",
          question: "Will Spain win the 2026 FIFA World Cup?",
          status: "active",
          marketType: "neg_risk",
          volume24h: "786700",
          yesOutcome: {
            assetId: "sample-esp-yes",
            price: "0.17"
          },
          noOutcome: {
            assetId: "sample-esp-no",
            price: "0.83"
          }
        },
        {
          marketId: "sample-france-champion",
          question: "Will France win the 2026 FIFA World Cup?",
          status: "active",
          marketType: "neg_risk",
          volume24h: "1253200",
          yesOutcome: {
            assetId: "sample-fra-yes",
            price: "0.16"
          },
          noOutcome: {
            assetId: "sample-fra-no",
            price: "0.84"
          }
        },
        {
          marketId: "sample-england-champion",
          question: "Will England win the 2026 FIFA World Cup?",
          status: "active",
          marketType: "neg_risk",
          volume24h: "208500",
          yesOutcome: {
            assetId: "sample-eng-yes",
            price: "0.11"
          },
          noOutcome: {
            assetId: "sample-eng-no",
            price: "0.89"
          }
        },
        {
          marketId: "sample-portugal-group-k",
          question: "Will Portugal finish first in Group K at the 2026 World Cup?",
          status: "active",
          marketType: "binary",
          volume: "243100",
          yesOutcome: {
            assetId: "sample-por-yes",
            price: "0.63"
          },
          noOutcome: {
            assetId: "sample-por-no",
            price: "0.37"
          }
        },
        {
          marketId: "sample-mexico-south-africa",
          question: "Will Mexico beat South Africa at the 2026 World Cup?",
          status: "active",
          marketType: "binary",
          startTime: "2026-06-13T13:00:00.000Z",
          volume: "1212300",
          yesOutcome: {
            assetId: "sample-mex-yes",
            price: "0.69"
          },
          noOutcome: {
            assetId: "sample-mex-no",
            price: "0.31"
          }
        },
        {
          marketId: "sample-korea-czechia",
          question: "Will South Korea beat Czechia at the 2026 World Cup?",
          status: "active",
          marketType: "binary",
          startTime: "2026-06-13T14:30:00.000Z",
          volume: "385000",
          yesOutcome: {
            assetId: "sample-kor-yes",
            price: "0.37"
          },
          noOutcome: {
            assetId: "sample-kor-no",
            price: "0.34"
          }
        },
        {
          marketId: "sample-kane-golden-boot",
          question: "Will Harry Kane win the 2026 World Cup Golden Boot?",
          status: "active",
          marketType: "binary",
          volume: "48100",
          yesOutcome: {
            assetId: "sample-kane-yes",
            price: "0.14"
          },
          noOutcome: {
            assetId: "sample-kane-no",
            price: "0.87"
          }
        }
      ]
    }
  ]
};
