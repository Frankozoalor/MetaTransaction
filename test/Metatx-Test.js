const { expect, use} = require("chai");
const { BigNumber } = require("ethers");
const { arrayify, parseEther} = require("ethers/lib/utils");
const {ethers} = require("hardhat");

describe("MetaTokenTransfer", function() {
    it("Should let user transfer through a relayer with different nonces", async function() {
        //Deploying the contract
        const RandomTokenFactory = await ethers.getContractFactory("RandomToken");
        const randomTokenContract = await RandomTokenFactory.deploy();
        await randomTokenContract.deployed();

        const MetaTokenSenderFactory = await ethers.getContractFactory("TokenSender");
        const TokenSenderContract = await MetaTokenSenderFactory.deploy();
        await TokenSenderContract.deployed();

        //Get three addresses, treating one as the user address
        //one as the relayer address and one as a receipent address
        const [_, userAddress, relayerAddress, receipentAddress] = await ethers.getSigners();

        //Minting 10,000 tokens to user address(for testing)
        const tenThousandTokensWithDecimals = parseEther("10000");
        const userTokenContractInstance = randomTokenContract.connect(userAddress);
        const MintTx = await userTokenContractInstance.freeMint(tenThousandTokensWithDecimals);
        await MintTx.wait();

        //Have user infinite approve the token sender contract for transferring "Random Token"
        const approveTxn = await userTokenContractInstance.approve(TokenSenderContract.address, BigNumber.from(
             // There are 64 f's in here.
             // In hexadecimal, each digit can represent 4 bits
             // f is the largest digit in hexadecimal (1111 in binary)
             // 4 + 4 = 8 i.e. two hex digits = 1 byte
             // 64 digits = 32 bytes
             // 32 bytes = 256 bits = uint256
             "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"
        ));
        await approveTxn.wait();

        //Have user sign message to transfer 10 tokens to recipient

        let nonce = 1;

        const transferAmountOfTokens = parseEther("10");
        const messageHash = await TokenSenderContract.getHash(userAddress.address, transferAmountOfTokens, receipentAddress.address, randomTokenContract.address, nonce);
        const signature = await userAddress.signMessage(arrayify(messageHash));

        //Have the relayer execute the transaction on behalf of the user
        const relayerSenderContractInstance = TokenSenderContract.connect(relayerAddress);
        const metaTxn = await relayerSenderContractInstance.transfer(
            userAddress.address, transferAmountOfTokens, receipentAddress.address, randomTokenContract.address, nonce, signature
        );
        await metaTxn.wait();
        //Verifying the user's balance decreased, and receipient got 10 tokens
        let userBalance = await randomTokenContract.balanceOf(userAddress.address);
        let receipentBalance = await randomTokenContract.balanceOf(receipentAddress.address);

        expect(userBalance.lt(tenThousandTokensWithDecimals)).to.be.true;
        expect(receipentBalance.gt(BigNumber.from(0))).to.be.true;

        //Increment the nonce
        nonce++

        //Have user sign a second message, with a different nonce, to transfer 10 more tokens
        const messageHash2 = await TokenSenderContract.getHash(
            userAddress.address,
            transferAmountOfTokens,
            receipentAddress.address,
            randomTokenContract.address,
            nonce
        )
        const signature2 = await userAddress.signMessage(arrayify(messageHash2));
        //Have the relayer execute the transaction on behalf of the user
        const metaTxn2 = await relayerSenderContractInstance.transfer(
            userAddress.address,
            transferAmountOfTokens,
            receipentAddress.address,
            randomTokenContract.address,
            nonce,
            signature2
        );
        await metaTxn2.wait();

        //Check the user's balance decreased, and recipient got 10 tokens
        userBalance = await randomTokenContract.balanceOf(userAddress.address);
        receipentBalance = await randomTokenContract.balanceOf(
            receipentAddress.address
        );

        expect(userBalance.eq(parseEther("9980"))).to.be.true;
        expect(receipentBalance.eq(parseEther("20"))).to.be.true;

    });

    it("Should not let signature replay happen", async function() {
        //Deploy the contracts
        const RandomTokenFactory = await ethers.getContractFactory("RandomToken");
        const randomTokenContract = await RandomTokenFactory.deploy()
        await randomTokenContract.deployed()

        const MetaTokenSenderFactory = await ethers.getContractFactory("TokenSender");
        const TokenSenderContract = await MetaTokenSenderFactory.deploy();
        await TokenSenderContract.deployed();

        const[_, userAddress, relayerAddress, receipentAddress] = await ethers.getSigners();

        //Mint 10,000 tokens to user address(for testing)
        const tenThousandTokensWithDecimals = parseEther("10000");
        const userTokenContractInstance = randomTokenContract.connect(userAddress);
        const MintTxn = await userTokenContractInstance.freeMint(tenThousandTokensWithDecimals);
        await MintTxn.wait();

        //Have user infinite approve the token sender contract for transferring 'RandomToken'
        const approveTxn = await userTokenContractInstance.approve(
            TokenSenderContract.address, BigNumber.from(
                 // This is uint256's max value (2^256 - 1) in hex
        "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"
            )
        );
        await approveTxn.wait();
        
        //Have user sign message to transfer 10 tokens to recipient
        let nonce = 1;

        const transferAmountOfTokens = parseEther("10");
        const messageHash = await TokenSenderContract.getHash(
            userAddress.address,
            transferAmountOfTokens,
            receipentAddress.address,
            randomTokenContract.address,
            nonce
        );
        const signature = await userAddress.signMessage(arrayify(messageHash));

        //Have the relayer execute the transaction on behalf of the user
        const relayerSenderContractInstance = TokenSenderContract.connect(relayerAddress);
        const metaTxn = await relayerSenderContractInstance.transfer(
            userAddress.address,
            transferAmountOfTokens,
            receipentAddress.address,
            randomTokenContract.address,
            nonce,
            signature
        );
        await metaTxn.wait();

        //Have the relayer attempt to execute the same transaction again with the same signature
        const metaTxn2 = await relayerSenderContractInstance.transfer(
            userAddress.address,
            transferAmountOfTokens,
            receipentAddress.address,
            randomTokenContract.address,
            nonce,
            signature
        );
        await metaTxn2.wait();

    });
})