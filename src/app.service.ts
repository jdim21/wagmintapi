import { Injectable } from '@nestjs/common';
import { stringify } from 'querystring';
import { pool } from './database';
import { AptosClient, AptosAccount, TokenClient, CoinClient } from "aptos";

const NODE_URL = process.env.APTOS_NODE_URL || "https://fullnode.mainnet.aptoslabs.com";
const aptosCoinStore = "0x1::coin::CoinStore<0x1::aptos_coin::AptosCoin>";
// const coinClient = new CoinClient(client);
// const privateKeyBuffer = Buffer.alloc(32,kPrivKey,'hex');
// const pdHex = "0xee62c8d9548e51b6b6ed1c312767ed990f47c1e0eb055463f880dc045bda23ac";
// const pdPrivKey = "0x6b3bffb8b0183ba2200f39102ab32a075f395c9648b0abe6db9e31f25e66cd61";
// const pd = new AptosAccount(new HexString(pdPrivKey).toUint8Array(), pdHex);

@Injectable()
export class AppService {
  async getHello(): Promise<string> {
    return await pool.connect().then(async (client) => {
      try {
        const selectQuery = {
          name: 'select-remaining',
          text: `
            select count(*) from public.wag_nft_uris where usedhash = ''
            `,
        }
        var res = await pool.query(selectQuery).catch((e: any) => {
          console.log("Error selecting mints query: " + e);
          client.release();
          return 'xxxx';
        });
        // const remaining = 5000 - parseInt(res.rows[0]["count"]);
        const remaining = parseInt(res.rows[0]["count"])
        client.release();
        // if (remaining <= 0) {
        //   return "SoldOut";
        // }
        return remaining;
      } catch (e) {
        console.log("Exception selecting mints from DB: " + e);
        client.release();
        return 'xxxx';
      }
    }).catch((e: any) => {
      console.log("Error connecting to DB: " + e);
      return 'xxxx';
    });
  }

  async getTokenList(): Promise<string> {
    return await pool.connect().then(async (client) => {
      try {
        const selectQuery = {
          name: 'select-token-list',
          text: `
            select created_at from public.mints where assigned = true 
            `,
        }
        var res = await pool.query(selectQuery).catch((e: any) => {
          console.log("Error selecting mints query: " + e);
          client.release();
          return 'xxxx';
        });
        var tokenList = {"tokenList": []};
        res.rows.forEach(async (address) => {
          if (address["created_at"] != null && address["created_at"] != undefined && address["created_at"] != "") {
            tokenList.tokenList.push(address["created_at"]);
          }
        });
        client.release();
        return tokenList;
      } catch (e) {
        console.log("Exception selecting mints from DB: " + e);
        client.release();
        return 'xxxx';
      }
    }).catch((e: any) => {
      console.log("Error connecting to DB: " + e);
      return 'xxxx';
    });
  }

  async postMintPayment(address: string, txnHash: string): Promise<string> {
    return await pool.connect().then(async (client) => {
      try {
        const insertWagMintPaymentQuery = {
          name: 'insert-wag-mint-payment',
          text: `
           INSERT INTO public.wag_mint_payment
           (address, txhash)
           VALUES($1, $2) ON CONFLICT (address, txhash) DO NOTHING;
          `,
          values: [address, txnHash]
        }
        await pool.query(insertWagMintPaymentQuery).catch((e) => {
          console.log("Error during insert wag mint payment query: " + e);
        });
        console.log("Should have inserted wag mint payment.");
      } catch (e) {
        console.log("Error writing payment tx to DB: " + e);
      }
      try {
        const selectWagNftUriQuery = {
          name: 'select-wag-nft-uri',
          text: `
            SELECT uri, id FROM public.wag_nft_uris
            WHERE usedhash = '' limit 1
          `
        }
        const client = new AptosClient(NODE_URL);
        const tokenClient = new TokenClient(client);
        const { HexString } = require('aptos');
        const kPrivKey = "0x1318f31b5a13445a4619e0476868b3b746fe8a45d5a04b5f1a9120f0495f2654";
        const kyle = new AptosAccount(new HexString(kPrivKey).toUint8Array(), "0xc7128b58e35237a9c101c9f1746e751a8a883c45cb2a7d781e9d09ac7f0e6849")
        console.log("kyleAccount: " + JSON.stringify(kyle));
        var uri = "unkown"
        var id = -1
        var selectWagNftUriRes = await pool.query(selectWagNftUriQuery).then(async res => {
          if (res.rows.length == 0)
          {
            console.log("OUT OF NFTS!");
          }
          uri = res.rows[0]["uri"]
          console.log("uri: " + uri);
          id = res.rows[0]["id"]
          console.log("uri, id: " + uri + ", " + JSON.stringify(id));
          var collectionName = "WAG";
          var tokenName = "WAG#" + JSON.stringify(id);
          const tokenPropertyVersion = 0
          try {
            const txnHashCollection = await tokenClient.createCollection(
              kyle,
              collectionName,
              "WealthyApdogeGang",
              "",
              5000,
            );
            await client.waitForTransaction(txnHashCollection, { checkSuccess: true });
            const updateWagUriHashUsed = {
              name: 'update-wag-nft-used',
              text: `
                UPDATE public.wag_nft_uris
                SET usedhash = $1
                WHERE uri = $2
              `,
              values: [txnHash, uri]
            }
            // var updateWagUriCheckedRes = await pool.query(updateWagUriChecked).then(async res => {});
            await pool.query(updateWagUriHashUsed).then(async () => {

              try {
                const txnHashCreateNftToken = await tokenClient.createToken(
                  kyle,
                  collectionName,
                  tokenName,
                  "WealthyApdogeGang",
                  1,
                  uri,
                  1, // TODO: this is the max, is this correct?
                )
                await client.waitForTransaction(txnHashCreateNftToken, { checkSuccess: true });
                try {
                  console.log("offering to address: " + JSON.stringify(address));
                  const txnHashOfferToken = await tokenClient.offerToken(
                    kyle,
                    address,
                    kyle.address(),
                    collectionName,
                    tokenName,
                    1,
                    tokenPropertyVersion
                  );
                  const txnOfferTokenRes = await client.waitForTransaction(txnHashOfferToken, { checkSuccess: true });
                  try {
                    console.log("Should have succeeded the offer.");
                    console.log(txnOfferTokenRes);
                    console.log("");
                    const insertWagOffer = {
                      name: 'insert-wag-offers',
                      text: `
                        INSERT INTO public.wag_offers
                        (uri, tokenname, recipient, checked, seen)
                        VALUES($1, $2, $3, false, now());
                      `,
                      values: [uri, tokenName, address]
                    }
                    // var updateWagUriCheckedRes = await pool.query(updateWagUriChecked).then(async res => {});
                    await pool.query(insertWagOffer).catch((e: any) => {
                      console.log("Error inserting wag offer (add,tx): " + address + ", " + txnHash + ": " + e);
                    });
                    // const collectionData = await tokenClient.getCollectionData(kyle.address(), collectionName);
                  } catch (e) {
                    console.log("Error offering and updating DB offers: " + e);
                  }
                } catch (e) {
                  console.log("Error creating nft token: " + e);
                }

              } catch (e) {
                console.log("Error creating token: " + e);
              }

            }).catch((e: any) => {
              console.log("Error updating uri used for (add,tx): " + address + ", " + txnHash + ": " + e);
            });

          } catch (e) {
            console.log("Error creating collection or updating payment checked: " + e);
          }
          
        }).catch((e) => {
          console.log("Error during select wag nft uri query: " + e);
        });
      } catch (e) {
        console.log("Error getting nft uri from DB: " + e);
      }

      client.release();
      return "Success.";
    }).catch((e: any) => {
      console.log("Error connecting to DB: " + e);
      return 'error connecting to DB';
    });
  }

  async getOffer(address: string): Promise<string> {
    return await pool.connect().then(async (client) => {
      const selectWagNftUriQuery = {
        name: 'select-wag-offer',
        text: `
          SELECT uri, tokenname FROM public.wag_offers
          WHERE recipient = $1 AND checked = false limit 1
        `,
        values: [address]
      }
      var uri = "unknown"
      var tokenName = "unknown"
      var selectWagNftUriRes = await pool.query(selectWagNftUriQuery).then(async res => {
        uri = res.rows[0]["uri"]
        tokenName = res.rows[0]["tokenname"] // sic
        console.log("uri, tokenName: " + uri + ", " + tokenName);
        // const updateWagOfferChecked = {
        //   name: 'update-wag-offers',
        //   text: `
        //     UPDATE public.wag_offers
        //     SET checked = true
        //     WHERE uri = $1
        //   `,
        //   values: [uri]
        // }
        // // var updateWagUriCheckedRes = await pool.query(updateWagUriChecked).then(async res => {});
        // await pool.query(updateWagOfferChecked).catch((e: any) => {
        //   console.log("Error updating offer checked for (uri): " + uri + ": " + e);
        // });
      }).catch((e) => {
        console.log("Error during select wag offer query: " + e);
      });
      client.release();
      // var uriAndTokenName = {
      //   uri: uri,
      //   tokenName: tokenName
      // }
      console.log("Got offer gracefully: " + JSON.stringify(tokenName));
      // return uriAndTokenName;
      return tokenName;
    }).catch((e: any) => {
      console.log("Error connecting to DB: " + e);
      return 'error connecting to DB';
    })
  }

  async getMarkOfferChecked(tokenId: string): Promise<string> {
    return await pool.connect().then(async (client) => {
      const tokenName = "WAG#" + tokenId
      console.log("tokenId: " + tokenId);
      const updateWagOfferChecked = {
        name: 'update-wag-offers',
        text: `
          UPDATE public.wag_offers
          SET checked = true
          WHERE tokenname = $1
        `,
        values: [tokenName]
      }
        // var updateWagUriCheckedRes = await pool.query(updateWagUriChecked).then(async res => {});
      await pool.query(updateWagOfferChecked).catch((e: any) => {
        console.log("Error updating offer checked for (tokenName): " + tokenName + ": " + e);
      });
      client.release();
      console.log("Updated offer gracefully: " + JSON.stringify(tokenName));
      return "Success.";
    }).catch((e: any) => {
      console.log("Error connecting to DB: " + e);
      return 'error connecting to DB';
    })
  }
}
