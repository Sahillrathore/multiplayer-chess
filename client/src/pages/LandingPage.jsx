import React from 'react'
import { Link } from 'react-router-dom'

const LandingPage = () => {
    return (
        <div>
            <h1 className='text-3xl font-bold'>Welcom to Chess.Xyz</h1>

            <div className="flex justify-center items-center">
                <Link to="play">
                    <button className="mt-4 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Play Now</button>
                </Link>
            </div>
        </div>
    )
}

export default LandingPage