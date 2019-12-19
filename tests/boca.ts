function A(inputA) => {
	return B(inputA).then(
            (outputB) => {
                return C(outputB).then((outputC) => {
                    return D(outputC);
                });
    });	
});

function B(val: any) : Promise<any> {
    return new Promise();
}