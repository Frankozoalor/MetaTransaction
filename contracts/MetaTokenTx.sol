//SPDX-License-Identifier: MIT

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

contract RandomToken is ERC20 {
    constructor() ERC20("", "") {}

    function freeMint(uint256 amount) public {
        _mint(msg.sender, amount);
    }
}

contract TokenSender {
    using ECDSA for bytes32;

    mapping(bytes32 => bool) executed;

    function transfer(
        address sender,
        uint256 amount,
        address recipient,
        address tokenContract,
        uint256 nonce,
        bytes memory signature
    ) public {
        bytes32 messageHash = getHash(
            sender,
            amount,
            recipient,
            tokenContract,
            nonce
        );
        bytes32 signedMessageHash = messageHash.toEthSignedMessageHash();

        //Require that this signature hasn't already been executed
        require(!executed[signedMessageHash], "Already executed");

        address signer = signedMessageHash.recover(signature);
        require(signer == sender, "signature does not come from sender");

        //Mark this signature as having been executed now
        executed[signedMessageHash] = true;
        bool sent = ERC20(tokenContract).transferFrom(
            sender,
            recipient,
            amount
        );
        require(sent, "Transfer failed");
    }

    function getHash(
        address sender,
        uint256 amount,
        address recipient,
        address tokenContract,
        uint256 nonce
    ) public pure returns (bytes32) {
        return
            keccak256(
                abi.encodePacked(
                    sender,
                    amount,
                    recipient,
                    tokenContract,
                    nonce
                )
            );
    }
}
